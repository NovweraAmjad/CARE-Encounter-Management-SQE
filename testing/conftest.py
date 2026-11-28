import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.test")

import django

django.setup()

import pytest
from importlib.util import find_spec

if find_spec("pytest_django") is None:
    import atexit

    from django.test.utils import setup_databases, teardown_databases

    # mutmut calls pytest.main() several times in ONE process (stats run, clean
    # run) and then forks one child per mutant. Rebuilding the test database on
    # a second call left API-created encounters failing a deferred foreign-key
    # check, and rebuilding it in every forked child exhausted mutmut's
    # per-mutant CPU limit (SIGXCPU -> false "timeout"/"killed"). So the
    # database is created once per PROCESS TREE: a forked child inherits the
    # "already set up" marker and reuses it. Every Django TestCase rolls back
    # its own changes. Only the process that created it tears it down.

    @pytest.fixture(scope="session", autouse=True)
    def django_test_database():
        if getattr(django, "_care_testing_db_config", None) is None:
            old_config = setup_databases(
                verbosity=0,
                interactive=False,
                keepdb=False,
            )
            owner = os.getpid()
            django._care_testing_db_config = (owner, old_config)
            atexit.register(
                lambda: os.getpid() == owner
                and teardown_databases(old_config, verbosity=0)
            )
        yield


# mutmut (process_isolation = fork) forks a child per mutant AFTER the parent
# has opened its database connection. A child that reuses or closes the
# inherited PostgreSQL socket breaks the shared session, and the resulting test
# errors are counted as false "kills". So in a forked child the inherited
# connection objects are set aside (kept referenced, never closed) and Django
# opens a fresh connection for the child.
_INHERITED_DB_CONNECTIONS = []


def _use_fresh_db_connections_in_child():
    from django.db import connections

    for conn in connections.all(initialized_only=True):
        if conn.connection is not None:
            _INHERITED_DB_CONNECTIONS.append(conn.connection)
            conn.connection = None


os.register_at_fork(after_in_child=_use_fresh_db_connections_in_child)


@pytest.fixture(autouse=True)
def clear_django_cache():
    """Each test's database rows are rolled back, but CARE caches some rows
    (e.g. patient identifier configs) in the Django cache. A stale cached id
    from an earlier test then violates a foreign key in a later test when
    pytest (used by mutmut) runs tests in a different order from Django's runner.
    """
    from django.core.cache import cache

    from care.emr.models.patient import PatientIdentifierConfigCache

    # In-process class-level cache in CARE ("TODO: Switch to Redis"); it survives
    # test-database rebuilds when pytest.main() runs twice in one process (mutmut).
    PatientIdentifierConfigCache.clear_cache()
    cache.clear()
    yield
    PatientIdentifierConfigCache.clear_cache()
    cache.clear()

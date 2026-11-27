import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.test")

import django

django.setup()

import pytest
from importlib.util import find_spec

if find_spec("pytest_django") is None:
    from django.test.utils import setup_databases, teardown_databases

    @pytest.fixture(scope="session", autouse=True)
    def django_test_database():
        old_config = setup_databases(
            verbosity=0,
            interactive=False,
            keepdb=False,
        )
        try:
            yield
        finally:
            teardown_databases(old_config, verbosity=0)

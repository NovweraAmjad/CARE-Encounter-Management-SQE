| # | Function | Mutant | Change | Class | Killing test | After |
|---|---|---|---|---|---|---|
| 1 | `LiveFilter.filter` | 2 | `- if not value: + if value:` | not-killed-defect | — | survived |
| 2 | `LiveFilter.filter` | 3 | `- if value.lower() == "true": + if value.upper() == "true":` | not-killed-defect | — | survived |
| 3 | `LiveFilter.filter` | 4 | `- if value.lower() == "true": + if value.lower() != "true":` | not-killed-defect | — | survived |
| 4 | `LiveFilter.filter` | 5 | `- if value.lower() == "true": + if value.lower() == "XXtrueXX":` | not-killed-defect | — | survived |
| 5 | `LiveFilter.filter` | 6 | `- if value.lower() == "true": + if value.lower() == "TRUE":` | not-killed-defect | — | survived |
| 6 | `LiveFilter.filter` | 7 | `- queryset = queryset.filter(status__in=COMPLETED_CHOICES) + queryset = None` | not-killed-defect | — | survived |
| 7 | `LiveFilter.filter` | 8 | `- queryset = queryset.filter(status__in=COMPLETED_CHOICES) + queryset = queryset.filter(status__in=None)` | not-killed-defect | — | survived |
| 8 | `LiveFilter.filter` | 9 | `- elif value.lower() == "false": + elif value.upper() == "false":` | not-killed-defect | — | survived |
| 9 | `LiveFilter.filter` | 10 | `- elif value.lower() == "false": + elif value.lower() != "false":` | not-killed-defect | — | survived |
| 10 | `LiveFilter.filter` | 11 | `- elif value.lower() == "false": + elif value.lower() == "XXfalseXX":` | not-killed-defect | — | survived |
| 11 | `LiveFilter.filter` | 12 | `- elif value.lower() == "false": + elif value.lower() == "FALSE":` | not-killed-defect | — | survived |
| 12 | `LiveFilter.filter` | 13 | `- queryset = queryset.exclude(status__in=COMPLETED_CHOICES) + queryset = None` | not-killed-defect | — | survived |
| 13 | `LiveFilter.filter` | 14 | `- queryset = queryset.exclude(status__in=COMPLETED_CHOICES) + queryset = queryset.exclude(status__in=None)` | not-killed-defect | — | survived |
| 14 | `EncounterViewSet.validate_data` | 5 | `- patient__external_id=instance.patient,` | missing-test | API-ENC-033 | killed |
| 15 | `EncounterViewSet.validate_data` | 13 | `- raise ValidationError("Patient does not exist") + raise ValidationError("XXPatient does not existXX")` | weak-assertion | UNIT-ENC-002 (exact message) | killed |
| 16 | `EncounterViewSet.validate_data` | 19 | `- raise ValidationError("Facility does not exist") + raise ValidationError("XXFacility does not existXX")` | weak-assertion | UNIT-ENC-003 (exact message) | killed |
| 17 | `EncounterViewSet.authorize_retrieve` | 10 | `- return True + return False` | equivalent | — | survived |
| 18 | `EncounterViewSet.authorize_retrieve` | 19 | `- return True + return False` | equivalent | — | survived |
| 19 | `EncounterViewSet.perform_create` | 4 | `- organizations = getattr(instance, "_organizations", []) + organizations = getattr(instance, "_organizations"` | equivalent | — | survived |
| 20 | `EncounterViewSet.perform_create` | 7 | `- organizations = getattr(instance, "_organizations", []) + organizations = getattr(instance, "_organizations"` | equivalent | — | survived |
| 21 | `EncounterViewSet.perform_create` | 21 | `- if not organizations: + if organizations:` | equivalent | — | survived |
| 22 | `EncounterViewSet.perform_create` | 22 | `- raise ValidationError("Encounter already has an associated booking") + raise ValidationError(None)` | weak-assertion | API-ENC-039 | killed |
| 23 | `EncounterViewSet.perform_create` | 23 | `- raise ValidationError("Encounter already has an associated booking") + raise ValidationError("XXEncounter al` | weak-assertion | API-ENC-039 | killed |
| 24 | `EncounterViewSet.perform_create` | 24 | `- raise ValidationError("Encounter already has an associated booking") + raise ValidationError("encounter alre` | weak-assertion | API-ENC-039 | killed |
| 25 | `EncounterViewSet.perform_create` | 25 | `- raise ValidationError("Encounter already has an associated booking") + raise ValidationError("ENCOUNTER ALRE` | weak-assertion | API-ENC-039 | killed |
| 26 | `EncounterViewSet.perform_create` | 26 | `- instance.appointment.associated_encounter = instance + instance.appointment.associated_encounter = None` | missing-test | API-ENC-039 | killed |
| 27 | `EncounterViewSet.perform_create` | 27 | `- instance.appointment.updated_by = self.request.user + instance.appointment.updated_by = None` | missing-test | API-ENC-039 | killed |
| 28 | `EncounterViewSet.perform_create` | 28 | `- update_fields=[ - "associated_encounter", - "updated_by", - "modified_date", - ] + update_fields=None` | equivalent | — | survived |
| 29 | `EncounterViewSet.perform_create` | 29 | `- "associated_encounter", + "XXassociated_encounterXX",` | missing-test | API-ENC-039 | killed |
| 30 | `EncounterViewSet.perform_create` | 30 | `- "associated_encounter", + "ASSOCIATED_ENCOUNTER",` | missing-test | API-ENC-039 | killed |
| 31 | `EncounterViewSet.perform_create` | 31 | `- "updated_by", + "XXupdated_byXX",` | missing-test | API-ENC-039 | killed |
| 32 | `EncounterViewSet.perform_create` | 32 | `- "updated_by", + "UPDATED_BY",` | missing-test | API-ENC-039 | killed |
| 33 | `EncounterViewSet.perform_create` | 33 | `- "modified_date", + "XXmodified_dateXX",` | missing-test | API-ENC-039 | killed |
| 34 | `EncounterViewSet.perform_create` | 34 | `- "modified_date", + "MODIFIED_DATE",` | missing-test | API-ENC-039 | killed |
| 35 | `EncounterViewSet.perform_create` | 37 | `- "Encounter creation failed, try again after a while" + None` | weak-assertion | API-ENC-040 | killed |
| 36 | `EncounterViewSet.perform_create` | 38 | `- "Encounter creation failed, try again after a while" + "XXEncounter creation failed, try again after a while` | weak-assertion | API-ENC-040 | killed |
| 37 | `EncounterViewSet.perform_create` | 39 | `- "Encounter creation failed, try again after a while" + "encounter creation failed, try again after a while"` | weak-assertion | API-ENC-040 | killed |
| 38 | `EncounterViewSet.perform_create` | 40 | `- "Encounter creation failed, try again after a while" + "ENCOUNTER CREATION FAILED, TRY AGAIN AFTER A WHILE"` | weak-assertion | API-ENC-040 | killed |
| 39 | `EncounterViewSet.perform_create` | 41 | `- instance.patient, instance.facility + None, instance.facility` | missing-test | API-ENC-034 | killed |
| 40 | `EncounterViewSet.perform_create` | 42 | `- instance.patient, instance.facility + instance.patient, None` | missing-test | API-ENC-034 | killed |
| 41 | `EncounterViewSet.perform_create` | 45 | `- instance.patient.build_facility_identifiers(instance.facility.id) + instance.patient.build_facility_identifi` | missing-test | API-ENC-034 | killed |
| 42 | `EncounterViewSet.perform_create` | 46 | `- instance.patient.save(update_fields=["facility_identifiers"]) + instance.patient.save(update_fields=None)` | equivalent | — | survived |
| 43 | `EncounterViewSet.authorize_update` | 10 | `- raise PermissionDenied("You do not have permission to update encounter") + raise PermissionDenied(None)` | weak-assertion | API-ENC-037 | killed |
| 44 | `EncounterViewSet.authorize_update` | 11 | `- raise PermissionDenied("You do not have permission to update encounter") + raise PermissionDenied("XXYou do ` | weak-assertion | API-ENC-037 | killed |
| 45 | `EncounterViewSet.authorize_update` | 12 | `- raise PermissionDenied("You do not have permission to update encounter") + raise PermissionDenied("you do no` | weak-assertion | API-ENC-037 | killed |
| 46 | `EncounterViewSet.authorize_update` | 13 | `- raise PermissionDenied("You do not have permission to update encounter") + raise PermissionDenied("YOU DO NO` | weak-assertion | API-ENC-037 | killed |
| 47 | `EncounterViewSet.authorize_create` | 1 | `- facility = get_object_or_404(Facility, external_id=instance.facility) + facility = None` | missing-test | API-ENC-036 | killed |
| 48 | `EncounterViewSet.authorize_create` | 9 | `- "can_create_encounter_obj", self.request.user, facility + "can_create_encounter_obj", self.request.user, Non` | missing-test | API-ENC-036 | killed |
| 49 | `EncounterViewSet.authorize_create` | 15 | `- raise PermissionDenied("You do not have permission to create encounter") + raise PermissionDenied(None)` | weak-assertion | API-ENC-036 | killed |
| 50 | `EncounterViewSet.authorize_create` | 16 | `- raise PermissionDenied("You do not have permission to create encounter") + raise PermissionDenied("XXYou do ` | weak-assertion | API-ENC-036 | killed |
| 51 | `EncounterViewSet.authorize_create` | 17 | `- raise PermissionDenied("You do not have permission to create encounter") + raise PermissionDenied("you do no` | weak-assertion | API-ENC-036 | killed |
| 52 | `EncounterViewSet.authorize_create` | 18 | `- raise PermissionDenied("You do not have permission to create encounter") + raise PermissionDenied("YOU DO NO` | weak-assertion | API-ENC-036 | killed |
| 53 | `EncounterViewSet.get_queryset` | 9 | `- "patient",` | equivalent | — | survived |
| 54 | `EncounterViewSet.get_queryset` | 10 | `- "facility",` | equivalent | — | survived |
| 55 | `EncounterViewSet.get_queryset` | 11 | `- "appointment",` | equivalent | — | survived |
| 56 | `EncounterViewSet.get_queryset` | 12 | `- "current_location",` | equivalent | — | survived |
| 57 | `EncounterViewSet.get_queryset` | 13 | `- "created_by",` | equivalent | — | survived |
| 58 | `EncounterViewSet.get_queryset` | 14 | `- "updated_by", - ) + )` | equivalent | — | survived |
| 59 | `EncounterViewSet.get_queryset` | 31 | `- self.action in ["list"] + self.action not in ["list"]` | missing-test | API-ENC-038 | killed |
| 60 | `EncounterViewSet.get_queryset` | 32 | `- self.action in ["list"] + self.action in ["XXlistXX"]` | missing-test | API-ENC-038 | killed |
| 61 | `EncounterViewSet.get_queryset` | 33 | `- self.action in ["list"] + self.action in ["LIST"]` | missing-test | API-ENC-038 | killed |
| 62 | `EncounterViewSet.get_queryset` | 34 | `- and "patient" in self.request.GET + and "XXpatientXX" in self.request.GET` | missing-test | API-ENC-038 | killed |
| 63 | `EncounterViewSet.get_queryset` | 35 | `- and "patient" in self.request.GET + and "PATIENT" in self.request.GET` | missing-test | API-ENC-038 | killed |
| 64 | `EncounterViewSet.get_queryset` | 37 | `- and self.request.GET["patient"] + and self.request.GET["XXpatientXX"]` | missing-test | API-ENC-038 | killed |
| 65 | `EncounterViewSet.get_queryset` | 38 | `- and self.request.GET["patient"] + and self.request.GET["PATIENT"]` | missing-test | API-ENC-038 | killed |
| 66 | `EncounterViewSet.get_queryset` | 39 | `- patient = get_object_or_404( - Patient, external_id=self.request.GET["patient"] - ) + patient = None` | missing-test | API-ENC-038 | killed |
| 67 | `EncounterViewSet.get_queryset` | 40 | `- Patient, external_id=self.request.GET["patient"] + None, external_id=self.request.GET["patient"]` | missing-test | API-ENC-038 | killed |
| 68 | `EncounterViewSet.get_queryset` | 41 | `- Patient, external_id=self.request.GET["patient"] + Patient, external_id=None` | missing-test | API-ENC-038 | killed |
| 69 | `EncounterViewSet.get_queryset` | 42 | `- Patient, external_id=self.request.GET["patient"] + external_id=self.request.GET["patient"]` | missing-test | API-ENC-038 | killed |
| 70 | `EncounterViewSet.get_queryset` | 43 | `- Patient, external_id=self.request.GET["patient"] - ) + Patient, )` | missing-test | API-ENC-038 | killed |
| 71 | `EncounterViewSet.get_queryset` | 44 | `- Patient, external_id=self.request.GET["patient"] + Patient, external_id=self.request.GET["XXpatientXX"]` | missing-test | API-ENC-038 | killed |
| 72 | `EncounterViewSet.get_queryset` | 45 | `- Patient, external_id=self.request.GET["patient"] + Patient, external_id=self.request.GET["PATIENT"]` | missing-test | API-ENC-038 | killed |
| 73 | `EncounterViewSet.get_queryset` | 46 | `- "can_view_patient_obj", self.request.user, patient + None, self.request.user, patient` | missing-test | API-ENC-038 | killed |
| 74 | `EncounterViewSet.get_queryset` | 47 | `- "can_view_patient_obj", self.request.user, patient + "can_view_patient_obj", None, patient` | missing-test | API-ENC-038 | killed |
| 75 | `EncounterViewSet.get_queryset` | 48 | `- "can_view_patient_obj", self.request.user, patient + "can_view_patient_obj", self.request.user, None` | missing-test | API-ENC-038 | killed |
| 76 | `EncounterViewSet.get_queryset` | 49 | `- "can_view_patient_obj", self.request.user, patient + self.request.user, patient` | missing-test | API-ENC-038 | killed |
| 77 | `EncounterViewSet.get_queryset` | 50 | `- "can_view_patient_obj", self.request.user, patient + "can_view_patient_obj", patient` | missing-test | API-ENC-038 | killed |
| 78 | `EncounterViewSet.get_queryset` | 51 | `- "can_view_patient_obj", self.request.user, patient - ): + "can_view_patient_obj", self.request.user, ):` | missing-test | API-ENC-038 | killed |
| 79 | `EncounterViewSet.get_queryset` | 52 | `- "can_view_patient_obj", self.request.user, patient + "XXcan_view_patient_objXX", self.request.user, patient` | missing-test | API-ENC-038 | killed |
| 80 | `EncounterViewSet.get_queryset` | 53 | `- "can_view_patient_obj", self.request.user, patient + "CAN_VIEW_PATIENT_OBJ", self.request.user, patient` | missing-test | API-ENC-038 | killed |
| 81 | `EncounterViewSet.get_queryset` | 54 | `- return qs.filter(patient=patient) + return qs.filter(patient=None)` | missing-test | API-ENC-038 | killed |
| 82 | `EncounterViewSet.get_queryset` | 55 | `- raise PermissionDenied("User cannot access patient") + raise PermissionDenied(None)` | weak-assertion | API-ENC-038 | killed |
| 83 | `EncounterViewSet.get_queryset` | 56 | `- raise PermissionDenied("User cannot access patient") + raise PermissionDenied("XXUser cannot access patientX` | weak-assertion | API-ENC-038 | killed |
| 84 | `EncounterViewSet.get_queryset` | 57 | `- raise PermissionDenied("User cannot access patient") + raise PermissionDenied("user cannot access patient")` | weak-assertion | API-ENC-038 | killed |
| 85 | `EncounterViewSet.get_queryset` | 58 | `- raise PermissionDenied("User cannot access patient") + raise PermissionDenied("USER CANNOT ACCESS PATIENT")` | weak-assertion | API-ENC-038 | killed |
| 86 | `EncounterViewSet.get_queryset` | 73 | `- Facility, external_id=self.request.GET["facility"] - ) + Facility, )` | missing-test | API-ENC-038 | killed |
| 87 | `EncounterViewSet.get_queryset` | 87 | `- if self.action in ["list"]: + if self.action in ["XXlistXX"]:` | missing-test | API-ENC-038 | killed |
| 88 | `EncounterViewSet.get_queryset` | 88 | `- if self.action in ["list"]: + if self.action in ["LIST"]:` | missing-test | API-ENC-038 | killed |
| 89 | `EncounterViewSet.get_queryset` | 89 | `- raise PermissionDenied("Cannot access encounters") + raise PermissionDenied(None)` | weak-assertion | API-ENC-038 | killed |
| 90 | `EncounterViewSet.get_queryset` | 90 | `- raise PermissionDenied("Cannot access encounters") + raise PermissionDenied("XXCannot access encountersXX")` | weak-assertion | API-ENC-038 | killed |
| 91 | `EncounterViewSet.get_queryset` | 91 | `- raise PermissionDenied("Cannot access encounters") + raise PermissionDenied("cannot access encounters")` | weak-assertion | API-ENC-038 | killed |
| 92 | `EncounterViewSet.get_queryset` | 92 | `- raise PermissionDenied("Cannot access encounters") + raise PermissionDenied("CANNOT ACCESS ENCOUNTERS")` | weak-assertion | API-ENC-038 | killed |
| 93 | `EncounterCreateSpec.perform_extra_deserialization` | 25 | `- external_id=self.appointment,` | missing-test | API-ENC-039 | killed |
| 94 | `EncounterCreateSpec.perform_extra_deserialization` | 40 | `- "history": [{"status": obj.status, "moved_at": str(timezone.now())}] + "history": [{"status": obj.status, "m` | weak-assertion | API-ENC-034 | killed |
| 95 | `EncounterUpdateSpec.perform_extra_deserialization` | 11 | `- {"status": self.status, "moved_at": str(timezone.now())} + {"status": self.status, "moved_at": str(None)}` | weak-assertion | API-ENC-035 | killed |
| 96 | `EncounterUpdateSpec.perform_extra_deserialization` | 12 | `- if self.discharge_summary_advice is None and is_update: + if self.discharge_summary_advice is None or is_upd` | missing-test | API-ENC-035 | killed |
| 97 | `EncounterListSpec.perform_extra_serialization` | 17 | `- mapping["current_location"] = None + mapping["XXcurrent_locationXX"] = None` | equivalent | — | survived |
| 98 | `EncounterListSpec.perform_extra_serialization` | 18 | `- mapping["current_location"] = None + mapping["CURRENT_LOCATION"] = None` | equivalent | — | survived |
| 99 | `EncounterRetrieveSpec.perform_extra_serialization` | 4 | `- mapping["patient"] = PatientRetrieveSpec.serialize( - obj.patient, facility=obj.facility - ).to_json() + map` | missing-test | API-ENC-041 | killed |
| 100 | `EncounterRetrieveSpec.perform_extra_serialization` | 5 | `- mapping["patient"] = PatientRetrieveSpec.serialize( + mapping["XXpatientXX"] = PatientRetrieveSpec.serialize` | missing-test | API-ENC-041 | killed |
| 101 | `EncounterRetrieveSpec.perform_extra_serialization` | 6 | `- mapping["patient"] = PatientRetrieveSpec.serialize( + mapping["PATIENT"] = PatientRetrieveSpec.serialize(` | missing-test | API-ENC-041 | killed |
| 102 | `EncounterRetrieveSpec.perform_extra_serialization` | 8 | `- obj.patient, facility=obj.facility + obj.patient, facility=None` | missing-test | API-ENC-034 | killed |
| 103 | `EncounterRetrieveSpec.perform_extra_serialization` | 10 | `- obj.patient, facility=obj.facility - ).to_json() + obj.patient, ).to_json()` | missing-test | API-ENC-034 | killed |
| 104 | `EncounterRetrieveSpec.perform_extra_serialization` | 11 | `- mapping["facility"] = FacilityBareMinimumSpec.serialize(obj.facility).to_json() + mapping["facility"] = None` | missing-test | API-ENC-041 | killed |
| 105 | `EncounterRetrieveSpec.perform_extra_serialization` | 12 | `- mapping["facility"] = FacilityBareMinimumSpec.serialize(obj.facility).to_json() + mapping["XXfacilityXX"] = ` | missing-test | API-ENC-041 | killed |
| 106 | `EncounterRetrieveSpec.perform_extra_serialization` | 13 | `- mapping["facility"] = FacilityBareMinimumSpec.serialize(obj.facility).to_json() + mapping["FACILITY"] = Faci` | missing-test | API-ENC-041 | killed |
| 107 | `EncounterRetrieveSpec.perform_extra_serialization` | 15 | `- mapping["tags"] = SingleFacilityTagManager().render_tags(obj) + mapping["tags"] = None` | missing-test | API-ENC-041 | killed |
| 108 | `EncounterRetrieveSpec.perform_extra_serialization` | 16 | `- mapping["tags"] = SingleFacilityTagManager().render_tags(obj) + mapping["XXtagsXX"] = SingleFacilityTagManag` | missing-test | API-ENC-041 | killed |
| 109 | `EncounterRetrieveSpec.perform_extra_serialization` | 17 | `- mapping["tags"] = SingleFacilityTagManager().render_tags(obj) + mapping["TAGS"] = SingleFacilityTagManager()` | missing-test | API-ENC-041 | killed |
| 110 | `EncounterRetrieveSpec.perform_extra_serialization` | 19 | `- mapping["appointment"] = TokenBookingReadSpec.serialize( - obj.appointment - ).to_json() + mapping["appointm` | missing-test | API-ENC-041 | killed |
| 111 | `EncounterRetrieveSpec.perform_extra_serialization` | 20 | `- mapping["appointment"] = TokenBookingReadSpec.serialize( + mapping["XXappointmentXX"] = TokenBookingReadSpec` | missing-test | API-ENC-041 | killed |
| 112 | `EncounterRetrieveSpec.perform_extra_serialization` | 21 | `- mapping["appointment"] = TokenBookingReadSpec.serialize( + mapping["APPOINTMENT"] = TokenBookingReadSpec.ser` | missing-test | API-ENC-041 | killed |
| 113 | `EncounterRetrieveSpec.perform_extra_serialization` | 22 | `- obj.appointment + None` | missing-test | API-ENC-041 | killed |
| 114 | `EncounterRetrieveSpec.perform_extra_serialization` | 24 | `- organizations = EncounterOrganization.objects.filter(encounter=obj) + organizations = EncounterOrganization.` | missing-test | API-ENC-041 | killed |
| 115 | `EncounterRetrieveSpec.perform_extra_serialization` | 25 | `- mapping["organizations"] = [ - FacilityOrganizationReadSpec.serialize(encounter_org.organization).to_json() ` | missing-test | API-ENC-041 | killed |
| 116 | `EncounterRetrieveSpec.perform_extra_serialization` | 26 | `- mapping["organizations"] = [ + mapping["XXorganizationsXX"] = [` | missing-test | API-ENC-041 | killed |
| 117 | `EncounterRetrieveSpec.perform_extra_serialization` | 27 | `- mapping["organizations"] = [ + mapping["ORGANIZATIONS"] = [` | missing-test | API-ENC-041 | killed |
| 118 | `EncounterRetrieveSpec.perform_extra_serialization` | 29 | `- mapping["location_history"] = [ - FacilityLocationEncounterListSpecWithLocation.serialize(i) - for i in Faci` | missing-test | API-ENC-041 | killed |
| 119 | `EncounterRetrieveSpec.perform_extra_serialization` | 30 | `- mapping["location_history"] = [ + mapping["XXlocation_historyXX"] = [` | missing-test | API-ENC-041 | killed |
| 120 | `EncounterRetrieveSpec.perform_extra_serialization` | 31 | `- mapping["location_history"] = [ + mapping["LOCATION_HISTORY"] = [` | missing-test | API-ENC-041 | killed |
| 121 | `EncounterRetrieveSpec.perform_extra_serialization` | 32 | `- FacilityLocationEncounterListSpecWithLocation.serialize(i) + FacilityLocationEncounterListSpecWithLocation.s` | missing-test | API-ENC-041 | killed |
| 122 | `EncounterRetrieveSpec.perform_extra_serialization` | 34 | `- for i in FacilityLocationEncounter.objects.filter(encounter=obj).order_by( + for i in FacilityLocationEncoun` | missing-test | API-ENC-041 | killed |
| 123 | `EncounterRetrieveSpec.perform_extra_serialization` | 37 | `- mapping["current_location"] = None + mapping["current_location"] = ""` | missing-test | API-ENC-041 | killed |
| 124 | `EncounterRetrieveSpec.perform_extra_serialization` | 38 | `- mapping["current_location"] = None + mapping["XXcurrent_locationXX"] = None` | equivalent | — | survived |
| 125 | `EncounterRetrieveSpec.perform_extra_serialization` | 39 | `- mapping["current_location"] = None + mapping["CURRENT_LOCATION"] = None` | equivalent | — | survived |
| 126 | `EncounterRetrieveSpec.perform_extra_serialization` | 40 | `- mapping["current_location"] = FacilityLocationMinimalListSpec.serialize( - obj.current_location - ).to_json(` | missing-test | API-ENC-041 | killed |
| 127 | `EncounterRetrieveSpec.perform_extra_serialization` | 41 | `- mapping["current_location"] = FacilityLocationMinimalListSpec.serialize( + mapping["XXcurrent_locationXX"] =` | missing-test | API-ENC-041 | killed |
| 128 | `EncounterRetrieveSpec.perform_extra_serialization` | 42 | `- mapping["current_location"] = FacilityLocationMinimalListSpec.serialize( + mapping["CURRENT_LOCATION"] = Fac` | missing-test | API-ENC-041 | killed |
| 129 | `EncounterRetrieveSpec.perform_extra_serialization` | 43 | `- obj.current_location + None` | missing-test | API-ENC-041 | killed |
| 130 | `EncounterRetrieveSpec.perform_extra_serialization` | 44 | `- care_team = [] + care_team = None` | missing-test | API-ENC-041 | killed |
| 131 | `EncounterRetrieveSpec.perform_extra_serialization` | 46 | `- user_mapping = {x["user_id"]: x for x in obj.care_team} + user_mapping = {x["XXuser_idXX"]: x for x in obj.c` | missing-test | API-ENC-041 | killed |
| 132 | `EncounterRetrieveSpec.perform_extra_serialization` | 47 | `- user_mapping = {x["user_id"]: x for x in obj.care_team} + user_mapping = {x["USER_ID"]: x for x in obj.care_` | missing-test | API-ENC-041 | killed |
| 133 | `EncounterRetrieveSpec.perform_extra_serialization` | 50 | `- { - "member": model_from_cache(UserSpec, id=user_id), - "role": user_mapping[user_id]["role"], - } + None` | missing-test | API-ENC-041 | killed |
| 134 | `EncounterRetrieveSpec.perform_extra_serialization` | 51 | `- "member": model_from_cache(UserSpec, id=user_id), + "XXmemberXX": model_from_cache(UserSpec, id=user_id),` | missing-test | API-ENC-041 | killed |
| 135 | `EncounterRetrieveSpec.perform_extra_serialization` | 52 | `- "member": model_from_cache(UserSpec, id=user_id), + "MEMBER": model_from_cache(UserSpec, id=user_id),` | missing-test | API-ENC-041 | killed |
| 136 | `EncounterRetrieveSpec.perform_extra_serialization` | 53 | `- "member": model_from_cache(UserSpec, id=user_id), + "member": model_from_cache(None, id=user_id),` | missing-test | API-ENC-041 | killed |
| 137 | `EncounterRetrieveSpec.perform_extra_serialization` | 54 | `- "member": model_from_cache(UserSpec, id=user_id), + "member": model_from_cache(UserSpec, id=None),` | missing-test | API-ENC-041 | killed |
| 138 | `EncounterRetrieveSpec.perform_extra_serialization` | 55 | `- "member": model_from_cache(UserSpec, id=user_id), + "member": model_from_cache(id=user_id),` | missing-test | API-ENC-041 | killed |
| 139 | `EncounterRetrieveSpec.perform_extra_serialization` | 56 | `- "member": model_from_cache(UserSpec, id=user_id), + "member": model_from_cache(UserSpec, ),` | missing-test | API-ENC-041 | killed |
| 140 | `EncounterRetrieveSpec.perform_extra_serialization` | 57 | `- "role": user_mapping[user_id]["role"], + "XXroleXX": user_mapping[user_id]["role"],` | missing-test | API-ENC-041 | killed |
| 141 | `EncounterRetrieveSpec.perform_extra_serialization` | 58 | `- "role": user_mapping[user_id]["role"], + "ROLE": user_mapping[user_id]["role"],` | missing-test | API-ENC-041 | killed |
| 142 | `EncounterRetrieveSpec.perform_extra_serialization` | 59 | `- "role": user_mapping[user_id]["role"], + "role": user_mapping[user_id]["XXroleXX"],` | missing-test | API-ENC-041 | killed |
| 143 | `EncounterRetrieveSpec.perform_extra_serialization` | 60 | `- "role": user_mapping[user_id]["role"], + "role": user_mapping[user_id]["ROLE"],` | missing-test | API-ENC-041 | killed |
| 144 | `EncounterRetrieveSpec.perform_extra_serialization` | 61 | `- mapping["care_team"] = care_team + mapping["care_team"] = None` | missing-test | API-ENC-041 | killed |
| 145 | `EncounterRetrieveSpec.perform_extra_serialization` | 62 | `- mapping["care_team"] = care_team + mapping["XXcare_teamXX"] = care_team` | missing-test | API-ENC-041 | killed |
| 146 | `EncounterRetrieveSpec.perform_extra_serialization` | 63 | `- mapping["care_team"] = care_team + mapping["CARE_TEAM"] = care_team` | missing-test | API-ENC-041 | killed |

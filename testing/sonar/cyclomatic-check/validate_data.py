class EncounterViewSet:
    def validate_data(self, instance, model_obj=None):
        if model_obj is None:
            if (
                self.database_model.objects.filter(
                    patient__external_id=instance.patient,
                    facility__external_id=instance.facility,
                )
                .exclude(status__in=COMPLETED_CHOICES)
                .count()
                >= settings.MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY
            ):
                error = f"Patient already has maximum number of active encounters ({settings.MAX_ACTIVE_ENCOUNTERS_PER_PATIENT_IN_FACILITY}) in the facility"
                raise ValidationError(error)

            if not Patient.objects.filter(external_id=instance.patient).exists():
                raise ValidationError("Patient does not exist")

            if not Facility.objects.filter(external_id=instance.facility).exists():
                raise ValidationError("Facility does not exist")

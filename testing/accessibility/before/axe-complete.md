# axe-core report (before): Complete Encounter (encounter updates screen)

- URL: http://127.0.0.1:4000/facility/209d3774-d521-4d96-b1d1-d3d7db4ab204/patient/a3f7d15b-0208-4a17-ac48-7bfa963ab1f9/encounter/c684b393-577b-4dc5-bf74-37aa6641b5e3/updates
- Timestamp: 2026-11-27T20:48:03.428Z
- axe-core: 4.14.1
- Violations: 2 rule(s)

## aria-command-name (serious)

ARIA commands must have an accessible name

- Selector: `#base-ui-_r_m_`
  - HTML: `<span role="button" tabindex="0" data-base-ui-click-trigger="" id="base-ui-_r_m_" aria-haspopup="dialog" aria-expanded="false" data-slot="sheet-trigger"></span>`
  - Failure: Fix any of the following:   Element does not have text that is visible to screen readers   aria-label attribute does not exist or is empty   aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty   Element has no title attribute

## label-content-name-mismatch (serious)

Elements must have their visible text as part of their accessible name

- Selector: `a[aria-label="Add Allergy"]`
  - HTML: `<a role="link" tabindex="0" data-slot="button" data-variant="outline" data-size="default" aria-label="Add Allergy" class="inline-flex items-ce..." href="/facility/209d3774-d...">`
  - Failure: Fix any of the following:   Text inside the element is not included in the accessible name
- Selector: `a[aria-label="Service Request"]`
  - HTML: `<a role="link" tabindex="0" data-slot="button" data-variant="outline" data-size="default" aria-label="Service Request" class="inline-flex items-ce..." href="/facility/209d3774-d...">`
  - Failure: Fix any of the following:   Text inside the element is not included in the accessible name
- Selector: `a[aria-label="Add Medication"]`
  - HTML: `<a role="link" tabindex="0" data-slot="button" data-variant="outline" data-size="default" aria-label="Add Medication" class="inline-flex items-ce..." href="/facility/209d3774-d...">`
  - Failure: Fix any of the following:   Text inside the element is not included in the accessible name
- Selector: `#base-ui-_r_1a_`
  - HTML: `<button type="button" tabindex="0" data-slot="dialog-trigger" data-variant="outline" data-size="default" data-base-ui-click-t...="" id="base-ui-_r_1a_" aria-haspopup="dialog" aria-expanded="false" aria-label="Forms" class="inline-flex items-ce...">`
  - Failure: Fix any of the following:   Text inside the element is not included in the accessible name
- Selector: `a[aria-label="Add Symptom"]`
  - HTML: `<a role="link" tabindex="0" data-slot="button" data-variant="outline" data-size="default" aria-label="Add Symptom" class="inline-flex items-ce..." href="/facility/209d3774-d...">`
  - Failure: Fix any of the following:   Text inside the element is not included in the accessible name
- Selector: `a[aria-label="Add Diagnosis"]`
  - HTML: `<a role="link" tabindex="0" data-slot="button" data-variant="outline" data-size="default" aria-label="Add Diagnosis" class="inline-flex items-ce..." href="/facility/209d3774-d...">`
  - Failure: Fix any of the following:   Text inside the element is not included in the accessible name
- Selector: `a[aria-label="Add Procedure"]`
  - HTML: `<a role="link" tabindex="0" data-slot="button" data-variant="outline" data-size="default" aria-label="Add Procedure" class="inline-flex items-ce..." href="/facility/209d3774-d...">`
  - Failure: Fix any of the following:   Text inside the element is not included in the accessible name
- Selector: `#base-ui-_r_1c_`
  - HTML: `<button type="button" tabindex="0" data-slot="dialog-trigger" data-variant="outline" data-size="default" data-base-ui-click-t...="" id="base-ui-_r_1c_" aria-haspopup="dialog" aria-expanded="false" aria-label="New Referral" class="inline-flex items-ce...">`
  - Failure: Fix any of the following:   Text inside the element is not included in the accessible name


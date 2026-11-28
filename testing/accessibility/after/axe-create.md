# axe-core report (after): Create Encounter dialog

- URL: http://127.0.0.1:4000/facility/209d3774-d521-4d96-b1d1-d3d7db4ab204/patients/home?phone_number=%2B916244366823&year_of_birth=1980&partial_id=a3f7d
- Timestamp: 2026-11-27T20:53:20.998Z
- axe-core: 4.14.1
- Violations: 1 rule(s)

## svg-img-alt (serious)

<svg> elements with an img or image role must have alternative text

- Selector: `#base-ui-_r_31_ > .care-l-calender.care-svg-icon__baseline.mr-0`
  - HTML: `<svg class="care-l-calender care-svg-icon__baseline mr-0 size-4 shrink-0" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">`
  - Failure: Fix any of the following:   Element has no child that is a title   aria-label attribute does not exist or is empty   aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty   Element has no title attribute


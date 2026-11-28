# axe-core Before-Fix Report: Create Encounter Screen

- URL: http://127.0.0.1:4000/facility/209d3774-d521-4d96-b1d1-d3d7db4ab204/patients/home?phone_number=%2B916244366823&year_of_birth=1980&partial_id=a3f7d
- Timestamp: 2026-11-27T18:16:20.776Z
- Violation count: 2

## label (critical)

Form elements must have labels

- Selector: `.file\:text-foreground`
  - HTML: <input autocomplete="off" data-slot="input" class="dark:bg-input/30 foc..." type="time" value="23:16">
  - Failure: Fix any of the following:
  Element does not have an implicit (wrapped) <label>
  Element does not have an explicit <label>
  aria-label attribute does not exist or is empty
  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty
  Element has no title attribute
  Element has no placeholder attribute
  Element's default semantics were not overridden with role="none" or role="presentation"

## svg-img-alt (serious)

<svg> elements with an img or image role must have alternative text

- Selector: `.care-l-calender`
  - HTML: <svg class="care-l-calender care-svg-icon__baseline mr-0 size-4 shrink-0" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  - Failure: Fix any of the following:
  Element has no child that is a title
  aria-label attribute does not exist or is empty
  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty
  Element has no title attribute


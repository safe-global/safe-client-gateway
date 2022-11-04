import Ajv from 'ajv';

/**
 * Registers isDate keyword in AJV
 *
 * When the value of isDate is set to true, the field will be validated
 * according to ISO 8601.
 *
 * If the date is valid, the target property is created as {@link Date}.
 * If the date is invalid, a validation error is thrown.
 *
 * Null date values are supported – we assume that a null date is a valid
 * date.
 *
 * @param ajv - the AJV instance to which the isDate keyword should be registered
 */
export function addIsDate(ajv: Ajv) {
  ajv.addKeyword({
    keyword: 'isDate',
    compile: (schema) => (value, obj) => {
      // isDate: false – no need to validate
      if (schema === false) return true;
      // Nullability support – if a date is null we skip validation
      if (value == null) return true;

      // From here we need to validate the date
      if (obj == null) return false;

      // Non valid date format
      if (isNaN(Date.parse(value))) return false;

      // We have a valid date. We can set the property in the parent object
      obj.parentData[obj.parentDataProperty] = new Date(value);
      return true;
    },
  });
}

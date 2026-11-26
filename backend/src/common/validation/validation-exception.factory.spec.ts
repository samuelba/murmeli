import type { ValidationError } from 'class-validator';
import {
  flattenValidationErrors,
  validationExceptionFactory,
} from './validation-exception.factory';

const errors: ValidationError[] = [
  {
    property: 'nickname',
    constraints: { isString: 'nickname must be a string' },
    children: [],
  },
  {
    property: 'avatar',
    children: [
      {
        property: 'color',
        constraints: { isHexColor: 'color must be a hex color' },
        children: [],
      },
    ],
  },
];

describe('validation errors', () => {
  it('flattens nested errors into field paths', () => {
    expect(flattenValidationErrors(errors)).toEqual([
      {
        field: 'nickname',
        constraints: ['isString'],
        messages: ['nickname must be a string'],
      },
      {
        field: 'avatar.color',
        constraints: ['isHexColor'],
        messages: ['color must be a hex color'],
      },
    ]);
  });

  it('builds a VALIDATION_FAILED exception', () => {
    const exception = validationExceptionFactory(errors);

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      errorCode: 'VALIDATION_FAILED',
      message: 'Validation failed',
      details: expect.any(Array),
    });
  });
});

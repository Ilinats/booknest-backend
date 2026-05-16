import { AppError } from '../../common/errors/base-errors';

export enum UserAddressErrorCode {
  ADDRESS_NOT_FOUND = 'ADDRESS_NOT_FOUND',
  ADDRESS_ACCESS_DENIED = 'ADDRESS_ACCESS_DENIED',
}

export const UserAddressErrors: Record<UserAddressErrorCode, AppError> = {
  [UserAddressErrorCode.ADDRESS_NOT_FOUND]: {
    code: UserAddressErrorCode.ADDRESS_NOT_FOUND,
    message: 'Address not found',
    statusCode: 404,
  },
  [UserAddressErrorCode.ADDRESS_ACCESS_DENIED]: {
    code: UserAddressErrorCode.ADDRESS_ACCESS_DENIED,
    message: 'Address not found or access denied',
    statusCode: 404,
  },
};

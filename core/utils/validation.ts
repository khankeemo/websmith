export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^[+]?[0-9()\-\s]{7,20}$/;
export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export const validateEmail = (value: string) => EMAIL_REGEX.test(value.trim().toLowerCase());

export const validatePhone = (value: string) => {
  const phone = value.trim();
  if (!phone) return true;
  return PHONE_REGEX.test(phone);
};

export const validateStrongPassword = (value: string) => STRONG_PASSWORD_REGEX.test(value);

export const getPasswordChecklist = (value: string) => ({
  minLength: value.length >= 8,
  uppercase: /[A-Z]/.test(value),
  lowercase: /[a-z]/.test(value),
  number: /\d/.test(value),
  special: /[^A-Za-z\d]/.test(value),
});

export const getPasswordValidationMessage = () =>
  "Password must include uppercase, lowercase, number, and special character, with at least 8 characters.";

export const getPasswordChecklistItems = (value: string) => {
  const checklist = getPasswordChecklist(value);
  return [
    { key: "minLength", label: "At least 8 characters", met: checklist.minLength },
    { key: "uppercase", label: "One uppercase letter", met: checklist.uppercase },
    { key: "lowercase", label: "One lowercase letter", met: checklist.lowercase },
    { key: "number", label: "One number", met: checklist.number },
    { key: "special", label: "One special character", met: checklist.special },
  ];
};

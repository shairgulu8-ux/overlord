const emailRegex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const phoneRegex =
    /^\+[1-9]\d{7,14}$/;

const usernameRegex =
    /^[a-zA-Z0-9_]{4,20}$/;

export const validateEmail = (email) => {
    if (!email)
        return "Email is required";

    if (!emailRegex.test(email))
        return "Invalid email address";

    return null;
};

export const validatePhone = (phone) => {
    if (!phone)
        return "Phone number is required";

    if (!phoneRegex.test(phone))
        return "Invalid phone number";

    return null;
};

export const validateUsername = (
    username
) => {
    if (!username)
        return "Username is required";

    if (!usernameRegex.test(username))
        return "Username must be 4-20 characters and contain only letters, numbers and underscores.";

    return null;
};

export const validatePassword = (password) => {
    if (!password)
        return "Password is required";

    if (password.length < 6)
        return "Password must be at least 6 characters.";

    return null;
};

export const validateConfirmPassword = (
    password,
    confirmPassword
) => {
    if (password !== confirmPassword)
        return "Passwords do not match.";

    return null;
};
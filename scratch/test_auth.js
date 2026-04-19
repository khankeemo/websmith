
const isPublicPath = (pathname) => {
  if (!pathname) return false;

  const PUBLIC_PATHS = [
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/forgotpassword",
    "/reset-password",
    "/resetpassword",
    "/auth/callback",
    "/services",
    "/lead-form",
    "/success",
    "/auth/change-password",
  ];

  // Normalize: lowercase, then remove all trailing slashes
  const normalized = pathname.toLowerCase().replace(/\/+$/, "") || "/";

  // Strict check
  const isMatch = PUBLIC_PATHS.some((p) => {
    const pNormalized = p.toLowerCase().replace(/\/+$/, "") || "/";
    return pNormalized === normalized;
  });

  if (isMatch) return true;

  // Fuzzy check for critical auth paths (fallback fix for Vercel trailing slash/hyphen oddities)
  const lowerPath = pathname.toLowerCase();
  
  // More aggressive defensive check for forgot/reset routes
  if (
    lowerPath.includes("/forgot") || 
    lowerPath.includes("/reset") ||
    lowerPath.startsWith("forgot") ||
    lowerPath.startsWith("reset")
  ) {
    return true;
  }

  return false;
};

console.log('"/forgot-password":', isPublicPath("/forgot-password"));
console.log('"/FORGOT-PASSWORD":', isPublicPath("/FORGOT-PASSWORD"));
console.log('"/forgot-password/":', isPublicPath("/forgot-password/"));
console.log('"/forgotpassword":', isPublicPath("/forgotpassword"));
console.log('"/reset-password":', isPublicPath("/reset-password"));
console.log('"/RESET-PASSWORD/":', isPublicPath("/RESET-PASSWORD/"));
console.log('"/dashboard":', isPublicPath("/dashboard"));
console.log('"forgot-password" (no slash):', isPublicPath("forgot-password"));

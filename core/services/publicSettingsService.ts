export type NavbarSectionKey = "projects" | "clients" | "developers" | "testimonials" | "softwareStore" | "industries" | "services";

export type NavbarVisibility = Record<NavbarSectionKey, boolean>;

export const defaultNavbarVisibility: NavbarVisibility = {
  projects: true,
  clients: true,
  developers: true,
  testimonials: true,
  softwareStore: true,
  industries: true,
  services: true,
};

const NAVBAR_VISIBILITY_KEY = "navbar_visibility";
export const NAVBAR_VISIBILITY_EVENT = "navbar-visibility-updated";

const normalizeNavbarVisibility = (value: Partial<NavbarVisibility> | null | undefined): NavbarVisibility => ({
  ...defaultNavbarVisibility,
  ...(value || {}),
});

export const getNavbarVisibility = async (): Promise<NavbarVisibility> => {
  const response = await fetch(`/api/settings/public/${NAVBAR_VISIBILITY_KEY}`);
  if (!response.ok) return defaultNavbarVisibility;
  const data = await response.json();
  return normalizeNavbarVisibility(data?.data);
};

export const updateNavbarVisibility = async (value: NavbarVisibility): Promise<NavbarVisibility> => {
  const nextValue = normalizeNavbarVisibility(value);
  const response = await fetch(`/api/settings/public/${NAVBAR_VISIBILITY_KEY}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: nextValue }),
  });
  const data = await response.json();
  const savedValue = normalizeNavbarVisibility(data?.data);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(NAVBAR_VISIBILITY_EVENT, JSON.stringify({ value: savedValue, at: Date.now() }));
    window.dispatchEvent(new CustomEvent(NAVBAR_VISIBILITY_EVENT, { detail: savedValue }));
  }

  return savedValue;
};

export const getSoftwareStoreVisibility = async (): Promise<boolean> => {
  const visibility = await getNavbarVisibility();
  return visibility.softwareStore;
};

export const updateSoftwareStoreVisibility = async (isVisible: boolean): Promise<boolean> => {
  const visibility = await getNavbarVisibility();
  const saved = await updateNavbarVisibility({
    ...visibility,
    softwareStore: isVisible,
  });
  return saved.softwareStore;
};

import API from "./apiService";

export type NavbarSectionKey = "projects" | "clients" | "developers" | "testimonials" | "softwareStore";

export type NavbarVisibility = Record<NavbarSectionKey, boolean>;

export const defaultNavbarVisibility: NavbarVisibility = {
  projects: true,
  clients: true,
  developers: true,
  testimonials: true,
  softwareStore: true,
};

const NAVBAR_VISIBILITY_KEY = "navbar_visibility";
export const NAVBAR_VISIBILITY_EVENT = "navbar-visibility-updated";

const normalizeNavbarVisibility = (value: Partial<NavbarVisibility> | null | undefined): NavbarVisibility => ({
  ...defaultNavbarVisibility,
  ...(value || {}),
});

export const getNavbarVisibility = async (): Promise<NavbarVisibility> => {
  const response = await API.get(`/settings/public/${NAVBAR_VISIBILITY_KEY}`);
  return normalizeNavbarVisibility(response.data?.data);
};

export const updateNavbarVisibility = async (value: NavbarVisibility): Promise<NavbarVisibility> => {
  const nextValue = normalizeNavbarVisibility(value);
  const response = await API.put(`/settings/public/${NAVBAR_VISIBILITY_KEY}`, {
    value: nextValue,
  });
  const savedValue = normalizeNavbarVisibility(response.data?.data);

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

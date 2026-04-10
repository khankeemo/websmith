import { useState, useEffect, useCallback } from "react";
import { getDevelopers, RoleUser } from "../../../../core/services/userService";

export function useDevelopers() {
  const [developers, setDevelopers] = useState<RoleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDevelopers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDevelopers();
      setDevelopers(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch developers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevelopers();
  }, [fetchDevelopers]);

  return { developers, loading, saving, error, fetchDevelopers };
}

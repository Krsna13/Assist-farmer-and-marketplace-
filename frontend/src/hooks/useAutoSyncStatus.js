/**
 * frontend/src/hooks/useAutoSyncStatus.js
 *
 * Hook that checks once on mount whether the authenticated user has
 * marketplace auto-publish enabled. Result cached in component state.
 *
 * Usage:
 *   const { autoPublishEnabled, loading } = useAutoSyncStatus();
 */
import { useState, useEffect } from "react";

const useAutoSyncStatus = () => {
  const [autoPublishEnabled, setAutoPublishEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    fetch("http://localhost:5000/api/auto-sync/status", {
      headers: { Authorization: token },
    })
      .then((res) => res.json())
      .then((data) => {
        setAutoPublishEnabled(!!data.autoPublishEnabled);
      })
      .catch(() => {
        setAutoPublishEnabled(false);
      })
      .finally(() => setLoading(false));
  }, []);

  return { autoPublishEnabled, loading };
};

export default useAutoSyncStatus;

import { useEffect, useState } from "react";
export function useMessagingDesktop() {
  const [value, setValue] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)"),
      update = () => setValue(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return value;
}

import { useEffect, useState } from "react";

/** Mørk modus – lagres i localStorage, init-script i index.html unngår blinking. */
export function useTheme() {
  const [dark, setDark] = useState<boolean>(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("hellosky:theme", dark ? "dark" : "light");
    } catch {
      /* localStorage utilgjengelig */
    }
  }, [dark]);
  return { dark, setDark };
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getUserInitials(name: string | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "U";
  
  let firstName = parts[0] || "";
  let lastName = parts[parts.length - 1] || "";
  
  if (firstName.startsWith("ال")) {
    firstName = firstName.substring(2);
  }
  if (lastName.startsWith("ال") && lastName.length > 2) {
    lastName = lastName.substring(2);
  }
  
  const firstChar = firstName[0] || "";
  const lastChar = lastName[0] || "";
  
  const getInitial = (char: string) => {
    const map: Record<string, string> = {
      "أ": "A", "ا": "A", "إ": "A", "آ": "A",
      "ب": "B",
      "ت": "T", "ة": "T",
      "ث": "T",
      "ج": "J",
      "ح": "H", "خ": "H",
      "د": "D",
      "ذ": "Z",
      "ر": "R",
      "ز": "Z",
      "س": "S", "ش": "S", "ص": "S",
      "ض": "D",
      "ط": "T", "ظ": "Z",
      "ع": "A", "غ": "G",
      "ف": "F",
      "ق": "Q", "ك": "K",
      "ل": "L",
      "م": "M",
      "ن": "N",
      "ه": "H",
      "و": "W",
      "ي": "Y", "ى": "Y", "ئ": "Y", "ؤ": "W"
    };
    return map[char] || char.toUpperCase();
  };
  
  const fInitial = getInitial(firstChar);
  const lInitial = getInitial(lastChar);
  
  return (fInitial + lInitial).toUpperCase().substring(0, 2) || "U";
}

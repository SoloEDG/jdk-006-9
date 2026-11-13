import { useState, useEffect } from "react";
export function useTranscript(sourceId: string) {
  const [query, setQuery] = useState(""),
    [follow, setFollow] = useState(true);
  useEffect(() => {
    setQuery("");
    setFollow(true);
  }, [sourceId]);
  return { query, setQuery, follow, setFollow };
}

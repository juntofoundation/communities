import React, { useEffect, useState, useMemo } from "react";
import { SubjectRepository } from "../factory";
import { Factory } from "../helpers/model";

export default function useEntries<SubjectClass>({
  perspectiveUuid,
  source,
  model,
}: {
  perspectiveUuid: string;
  source: string | null | undefined;
  model: SubjectClass;
}) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<SubjectClass[]>([]);

  const Model = useMemo(() => {
    return new SubjectRepository(model, { perspectiveUuid, source });
  }, [perspectiveUuid, source]);

  useEffect(() => {
    if (perspectiveUuid && source !== null) {
      getAll();
      subscribe();
    }
    return () => Model?.unsubscribe();
  }, [perspectiveUuid, source]);

  async function getAll() {
    try {
      setLoading(true);
      const entries = await Model.getAll();
      setEntries(entries);
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }

  function subscribe() {
    Model.onAdded((entry) => {
      setEntries((oldEntries) => {
        const hasEntry = oldEntries.find((e) => e.id === entry.id);
        return hasEntry ? oldEntries : [entry, ...oldEntries];
      });
    });
  }

  return { entries, model: Model, loading };
}

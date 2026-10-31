import { useEffect, useState } from 'react';
import { catalogService } from '../services/catalog.service.js';

export function useCatalog({ search, category, sort = 'fecha' }) {
  const [categories, setCategories] = useState([]);
  const [events, setEvents] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCategoriesLoading(true);
    setCategoriesError('');
    catalogService.getCategories({ signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setCategories(result); })
      .catch((error) => { if (!controller.signal.aborted) setCategoriesError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setCategoriesLoading(false); });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    const controller = new AbortController();
    setEvents([]);
    setEventsLoading(true);
    setEventsError('');
    // Una breve espera evita una solicitud por tecla; la cancelación evita resultados atrasados.
    const timer = setTimeout(() => {
      catalogService.getEvents({ search, category, sort }, { signal: controller.signal })
        .then((result) => { if (!controller.signal.aborted) setEvents(result); })
        .catch((error) => { if (!controller.signal.aborted) setEventsError(error.message); })
        .finally(() => { if (!controller.signal.aborted) setEventsLoading(false); });
    }, search.trim() ? 300 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, category, sort, revision]);

  return { events, categories, loading: categoriesLoading || eventsLoading,
    error: categoriesError || eventsError, reload: () => setRevision((value) => value + 1) };
}

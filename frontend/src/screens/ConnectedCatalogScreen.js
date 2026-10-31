import CatalogScreen from './CatalogScreen';
import { useCatalog } from '../hooks/useCatalog';

export default function ConnectedCatalogScreen({ filters, onFilters, onOpenEvent }) {
  const { events, categories, loading, error, reload } = useCatalog(filters);
  return <CatalogScreen events={events} organizers={events.map((event) => event.organizador)}
    filters={filters} onFilters={onFilters} onOpenEvent={onOpenEvent}
    availableCategories={[{ id: 'Todos', nombre: 'Todos' }, ...categories]}
    serverFiltered showSort={false} showRatings={false} loading={loading} error={error}
    onRetry={reload} onRefresh={reload} />;
}

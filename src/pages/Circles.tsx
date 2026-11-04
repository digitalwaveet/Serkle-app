import { SerkleLoader } from '@/components/ui/SerkleLoader';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import CircleCard from '@/components/circles/CircleCard';
import CircleManageModal from '@/components/circles/CircleManageModal';
import FooterNav from '@/components/FooterNav';
import { useCircles, useMyCircles, useOwnedCircles, useSearchCircles, Circle } from '@/hooks/useCircles';
import { useCircleMutations } from '@/hooks/useCircleMutations';
import { useUser } from '@/contexts/UserContext';
import { CIRCLE_TYPES, CIRCLE_CATEGORIES, displayCategory } from '@/lib/circleTypes';
import { type TabKey } from '@/hooks/useAppNav';
import { formatCircleCount } from '@/lib/circleCountFormat';
import { circleLoginPath } from '@/lib/authReturnPath';
import { separateCircleCollections } from '@/lib/circleMembership';

interface CirclesProps {
  activeTab: TabKey;
  onTabSelect: (tab: TabKey) => void;
  onOpenCreate: () => void;
}

interface CircleFilters {
  category: string;
  type: string;
  pricing: 'all' | 'free' | 'paid';
  meeting: 'all' | 'online' | 'local';
  sort: 'newest' | 'active' | 'members';
}

const DEFAULT_FILTERS: CircleFilters = {
  category: 'all',
  type: 'all',
  pricing: 'all',
  meeting: 'all',
  sort: 'newest',
};

const SORT_LABELS: Record<CircleFilters['sort'], string> = {
  newest: 'Newest',
  active: 'Most active',
  members: 'Most members',
};

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const FilterChip: React.FC<FilterChipProps> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full border text-xs transition-all active:scale-95 ${
      active
        ? 'bg-primary text-primary-foreground border-primary'
        : 'border-border text-muted-foreground hover:border-primary/50'
    }`}
  >
    {children}
  </button>
);

/** Staggered entrance for list items; delay is capped so long lists stay snappy.
 *  min-w-0 stops no-wrap card content from stretching the grid column. */
const StaggerItem: React.FC<{ index: number; children: React.ReactNode }> = ({ index, children }) => (
  <div
    className="animate-fade-in min-w-0 max-w-full"
    style={{ animationDelay: `${Math.min(index, 5) * 60}ms`, animationFillMode: 'both' }}
  >
    {children}
  </div>
);

const Circles: React.FC<CirclesProps> = ({ activeTab, onTabSelect, onOpenCreate }) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the search so filtering doesn't run on every keystroke
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const [circleTab, setCircleTab] = useState('discover');
  const [manageCircle, setManageCircle] = useState<Circle | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<CircleFilters>(DEFAULT_FILTERS);

  const { data: allCircles = [], isLoading: isLoadingAll, isError: isAllError, refetch: retryAll } = useCircles(user?.id);
  const { data: myCircles = [], isLoading: isLoadingMy, isError: isMyError, refetch: retryMy } = useMyCircles(user?.id || '');
  const { data: ownedCircles = [], isLoading: isLoadingOwned, isError: isOwnedError, refetch: retryOwned } = useOwnedCircles(user?.id || '');
  const { joinCircle, isJoining } = useCircleMutations();

  // From 2 characters, Browse searches the whole database instead of only the
  // circles already downloaded
  const searchActive = debouncedQuery.trim().length >= 2;
  const { data: searchResults = [], isFetching: isSearching, isError: isSearchError, refetch: retrySearch } = useSearchCircles(debouncedQuery, user?.id);

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value !== DEFAULT_FILTERS[key as keyof CircleFilters]
  ).length;

  const handleJoinCircle = async (circleId: string) => {
    if (!user?.id) { navigate(circleLoginPath(`/circle/${circleId}`)); return; }
    const circle = [...searchResults, ...allCircles].find(c => c.id === circleId);
    if (circle?.membership_state?.state === 'subscription_required') {
      navigate(`/circle/${circleId}`);
      return;
    }
    try { await joinCircle(circleId, user.id); } catch { /* Mutation shows the error. */ }
  };

  const applyFilters = (circles: Circle[]) => {
    const query = debouncedQuery.toLowerCase();
    const result = circles
      .filter((circle) =>
        circle.name.toLowerCase().includes(query) ||
        circle.description.toLowerCase().includes(query) ||
        circle.category.toLowerCase().includes(query)
      )
      .filter((circle) => filters.category === 'all' || displayCategory(circle.category) === filters.category)
      .filter((circle) => filters.type === 'all' || circle.circle_type === filters.type)
      .filter((circle) =>
        filters.pricing === 'all' ||
        (filters.pricing === 'paid' ? !!circle.subscription_enabled : !circle.subscription_enabled)
      )
      .filter((circle) =>
        filters.meeting === 'all' ||
        (filters.meeting === 'online' ? circle.is_online !== false : circle.is_online === false)
      );

    if (filters.sort === 'members') {
      result.sort((a, b) => (b.members_count || 0) - (a.members_count || 0));
    } else if (filters.sort === 'active') {
      result.sort((a, b) => {
        const aTime = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
        const bTime = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
        return bTime - aTime;
      });
    }
    // 'newest' keeps the server order (created_at desc)

    return result;
  };

  const browseSource = searchActive ? searchResults : allCircles;
  const filteredAllCircles = applyFilters(browseSource.filter((circle) => circle.creator_id !== user?.id));
  const collections = separateCircleCollections(ownedCircles, myCircles);
  const filteredMyCircles = applyFilters(collections.joined);
  const filteredOwnedCircles = applyFilters(collections.created);
  const isBrowseLoading = isLoadingAll || (searchActive && isSearching);

  const hasQueryOrFilters = !!debouncedQuery || activeFilterCount > 0;

  const clearFilter = (key: keyof CircleFilters) =>
    setFilters((f) => ({ ...f, [key]: DEFAULT_FILTERS[key] }));

  const activeChips: { key: keyof CircleFilters; label: string }[] = [
    ...(filters.pricing !== 'all' ? [{ key: 'pricing' as const, label: filters.pricing === 'free' ? 'Free' : 'Premium' }] : []),
    ...(filters.type !== 'all' ? [{ key: 'type' as const, label: CIRCLE_TYPES.find((t) => t.id === filters.type)?.label || filters.type }] : []),
    ...(filters.category !== 'all' ? [{ key: 'category' as const, label: filters.category }] : []),
    ...(filters.meeting !== 'all' ? [{ key: 'meeting' as const, label: filters.meeting === 'online' ? 'Online' : 'Local' }] : []),
    ...(filters.sort !== 'newest' ? [{ key: 'sort' as const, label: SORT_LABELS[filters.sort] }] : []),
  ];

  return (
    <div className="min-h-[100dvh] w-full max-w-[480px] mx-auto bg-background text-foreground selection:bg-secondary/40 relative border-l border-r border-border font-sans overflow-x-hidden" data-testid="circles-page">
      {/* Header */}
      <header className="sticky top-0 left-0 right-0 z-50 bg-background backdrop-blur-md border-b border-border w-full">
        <div className="flex items-center gap-3 p-4">
         <h1 className="text-xl font-semibold text-foreground">Circles</h1>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search circles, topics, or locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2"
              onClick={() => setFiltersOpen(true)}
            >
              <div className="relative">
                <Filter className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </div>
            </Button>
          </div>

          {/* Applied filter chips */}
          {activeChips.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2 animate-fade-in">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => clearFilter(chip.key)}
                  className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/15 active:scale-95 transition-all"
                >
                  {chip.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-24">
        <Tabs value={circleTab} onValueChange={setCircleTab} className="w-full">
          <div className="px-4 mt-3">
            <TabsList className="grid w-full grid-cols-3 h-9 max-w-full">
              <TabsTrigger value="discover" className="text-xs px-1 min-w-0">Discover</TabsTrigger>
              <TabsTrigger value="joined" className="text-xs px-1 min-w-0">Joined</TabsTrigger>
              <TabsTrigger value="created" className="text-xs px-1 min-w-0">Created</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="discover" className="mt-4">
            <div className="px-4">
              <p className="text-xs text-muted-foreground mb-3">
                {hasQueryOrFilters && !isLoadingAll
                  ? `${formatCircleCount(filteredAllCircles.length, 'circle')} found`
                  : 'Discover and join circles created by others'}
              </p>
              <div className="grid gap-4">
                {(searchActive ? isSearchError : isAllError) ? (
                  <div className="text-center py-12 space-y-3"><p>Could not verify Circle membership.</p><Button variant="outline" onClick={() => searchActive ? retrySearch() : retryAll()}>Retry</Button></div>
                ) : isBrowseLoading ? (
                  <div className="min-h-48 w-full flex items-center justify-center py-8"><SerkleLoader label="Loading circles" showText /></div>
                ) : filteredAllCircles.length === 0 ? (
                  <div className="text-center py-12 space-y-3">
                    <p className="text-muted-foreground">
                      {hasQueryOrFilters ? 'No circles match your search' : 'No circles available yet'}
                    </p>
                    {activeFilterCount > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredAllCircles.map((circle, index) => (
                    <StaggerItem key={circle.id} index={index}>
                      <CircleCard
                        circle={circle}
                        onClick={() => navigate(`/circle/${circle.id}`)}
                        onJoin={handleJoinCircle}
                        isJoining={isJoining}
                      />
                    </StaggerItem>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="joined" className="mt-4">
            <div className="px-4">
              <p className="text-xs text-muted-foreground mb-3">Circles you've joined as a member</p>
              <div className="grid gap-4">
                {isLoadingMy ? (
                  <div className="min-h-48 w-full flex items-center justify-center py-8"><SerkleLoader label="Loading circles" showText /></div>
                ) : isMyError ? (
                  <div className="text-center py-12 space-y-3"><p>Could not load your joined circles.</p><Button variant="outline" onClick={() => retryMy()}>Retry</Button></div>
                ) : filteredMyCircles.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {hasQueryOrFilters ? 'No circles found matching your search' : "You haven't joined any circles yet"}
                  </div>
                ) : (
                  filteredMyCircles.map((circle, index) => (
                    <StaggerItem key={circle.id} index={index}>
                      <CircleCard
                        circle={circle}
                        onClick={() => navigate(`/circle/${circle.id}`)}
                      />
                    </StaggerItem>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="created" className="mt-4">
            <div className="px-4">
              <p className="text-xs text-muted-foreground mb-3">Circles you own or created</p>
              <div className="grid gap-4">
                {isLoadingOwned ? (
                  <div className="min-h-48 w-full flex items-center justify-center py-8"><SerkleLoader label="Loading circles" showText /></div>
                ) : isOwnedError ? (
                  <div className="text-center py-12 space-y-3"><p>Could not load your created circles.</p><Button variant="outline" onClick={() => retryOwned()}>Retry</Button></div>
                ) : filteredOwnedCircles.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    {hasQueryOrFilters ? 'No circles found matching your search' : "You haven't created any circles yet"}
                  </div>
                ) : (
                  filteredOwnedCircles.map((circle, index) => (
                    <StaggerItem key={circle.id} index={index}>
                      <CircleCard
                        circle={circle}
                        onClick={() => navigate(`/circle/${circle.id}`)}
                        onManage={() => setManageCircle(circle)}
                      />
                    </StaggerItem>
                  ))
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Filters Sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80dvh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Filter circles</SheetTitle>
          </SheetHeader>

          <div className="space-y-5 py-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Sort by</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(SORT_LABELS) as CircleFilters['sort'][]).map((option) => (
                  <FilterChip
                    key={option}
                    active={filters.sort === option}
                    onClick={() => setFilters((f) => ({ ...f, sort: option }))}
                  >
                    {SORT_LABELS[option]}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Pricing</p>
              <div className="flex flex-wrap gap-2">
                {(['all', 'free', 'paid'] as const).map((option) => (
                  <FilterChip
                    key={option}
                    active={filters.pricing === option}
                    onClick={() => setFilters((f) => ({ ...f, pricing: option }))}
                  >
                    {option === 'all' ? 'All' : option === 'free' ? 'Free' : 'Premium'}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Circle type</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={filters.type === 'all'}
                  onClick={() => setFilters((f) => ({ ...f, type: 'all' }))}
                >
                  All
                </FilterChip>
                {CIRCLE_TYPES.map((type) => (
                  <FilterChip
                    key={type.id}
                    active={filters.type === type.id}
                    onClick={() => setFilters((f) => ({ ...f, type: type.id }))}
                  >
                    {type.label}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={filters.category === 'all'}
                  onClick={() => setFilters((f) => ({ ...f, category: 'all' }))}
                >
                  All
                </FilterChip>
                {CIRCLE_CATEGORIES.map((category) => (
                  <FilterChip
                    key={category}
                    active={filters.category === category}
                    onClick={() => setFilters((f) => ({ ...f, category }))}
                  >
                    {category}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Where</p>
              <div className="flex flex-wrap gap-2">
                {(['all', 'online', 'local'] as const).map((option) => (
                  <FilterChip
                    key={option}
                    active={filters.meeting === option}
                    onClick={() => setFilters((f) => ({ ...f, meeting: option }))}
                  >
                    {option === 'all' ? 'All' : option === 'online' ? 'Online' : 'Local'}
                  </FilterChip>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pb-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              disabled={activeFilterCount === 0}
            >
              Clear all
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Show results
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Manage Modal */}
      {manageCircle && (
        <CircleManageModal
          circle={manageCircle}
          open={!!manageCircle}
          onOpenChange={(open) => { if (!open) setManageCircle(null); }}
        />
      )}

      {/* Footer Navigation */}
      <FooterNav
        active={activeTab}
        onSelect={onTabSelect}
        onOpenCreate={onOpenCreate}
      />
    </div>
  );
};

export default Circles;

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CircleDetail from '@/pages/CircleDetail';
import { type TabKey } from '@/hooks/useAppNav';
import { usePersistedNavState } from '@/hooks/usePersistedNavState';

const CircleDetailWrapper: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { activeTab, setActiveTab } = usePersistedNavState();

  const handleOpenCreate = () => {
    navigate('/');
  };

  if (!id) return null;

  return (
    <CircleDetail
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onTabSelect={setActiveTab}
      onOpenCreate={handleOpenCreate}
    />
  );
};

export default CircleDetailWrapper;
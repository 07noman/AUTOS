import { useNavigate } from 'react-router-dom';
import FirstActivation, { BusinessType } from '../activation/FirstActivation';
import { useAuth } from '@/hooks/useAuth';

export function ModuleSelector({ onBack }: { onBack?: () => void }) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const handleActivate = async (businessType: BusinessType) => {
    localStorage.setItem('genx:selectedModule', businessType);

    // 1# When customer chooses business type, ask for login if not logged in yet
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      // If already logged in, navigate to the unified business launcher
      if (businessType === 'auto-parts') {
        navigate('/auto-care');
      } else {
        navigate(`/business/${businessType}`);
      }
    }
  };

  return (
    <FirstActivation
      businessName={isAuthenticated && user?.name && !user.name.includes('offline') ? user.name : undefined}
      onActivate={handleActivate}
      onBack={onBack}
    />
  );
}

export default ModuleSelector;

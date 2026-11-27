import type { Metadata } from 'next';
import { Profile } from '../../../components/workspace/Profile';

export const metadata: Metadata = { title: 'Hồ sơ cá nhân' };

export default function ProfilePage() {
  return <Profile />;
}

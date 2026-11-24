import React from 'react';
import { navigate } from '../App';
import { Card, PageHeader, Tabs } from '../components/ui';
import { AcademicsForm, ActivitiesEditor, BasicsForm, FinancialForm, PersonalForm, TranscriptEditor, profileCompleteness } from '../components/forms';
import { useStore } from '../lib/store';

const TABS = [
  { id: 'profile', label: 'Basics' }, { id: 'profile-academics', label: 'Academics & testing' }, { id: 'profile-transcript', label: 'Transcript' },
  { id: 'profile-activities', label: 'Activities' }, { id: 'profile-personal', label: 'Personal' }, { id: 'profile-financial', label: 'Financial' },
] as const;

export default function Profile({ route }: { route: string }) {
  const s = useStore((x) => x);
  const last = s.meta.lastSaved ? new Date(s.meta.lastSaved).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;
  const tab = (TABS.find((t) => t.id === route)?.id || 'profile') as (typeof TABS)[number]['id'];
  return (
    <>
      <PageHeader title="Your profile" desc={<>Complete it gradually — every field is optional and saves automatically{last ? <> · last saved {last}</> : null}. Profile {profileCompleteness(s).pct}% complete.</>} />
      <Tabs tabs={TABS.map((t) => ({ ...t, count: t.id === 'profile-transcript' ? s.courses.length : t.id === 'profile-activities' ? s.activities.length : undefined }))} value={tab} onChange={(v) => navigate(v)} className="mb-6" />
      <div key={tab} className="fade-up">
        {tab === 'profile' && <Card className="p-5 sm:p-7"><BasicsForm /></Card>}
        {tab === 'profile-academics' && <Card className="p-5 sm:p-7"><AcademicsForm /></Card>}
        {tab === 'profile-transcript' && <TranscriptEditor />}
        {tab === 'profile-activities' && <ActivitiesEditor />}
        {tab === 'profile-personal' && <Card className="p-5 sm:p-7"><PersonalForm /></Card>}
        {tab === 'profile-financial' && <Card className="p-5 sm:p-7"><FinancialForm /></Card>}
      </div>
    </>
  );
}

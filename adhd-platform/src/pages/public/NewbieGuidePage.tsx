import NewbieGuideContent from '../../content/guide/newbie-guide';

export default function NewbieGuidePage() {
  return (
    <div className="min-h-screen bg-cream text-brown py-12 px-4 md:px-8">
      <div className="max-w-4xl mx-auto bg-white border-2 border-brown rounded-3xl p-6 md:p-10 shadow-warm-lg">
        <NewbieGuideContent />
      </div>
    </div>
  );
}

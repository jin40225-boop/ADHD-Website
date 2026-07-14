import NewbieGuideContent from '../../content/guide/newbie-guide';

export default function NewbieGuidePage() {
  return (
    <div className="min-h-screen bg-[#FFFDF5] text-[#5D4037] py-12 px-4 md:px-8">
      <div className="max-w-4xl mx-auto bg-white border-2 border-[#5D4037] rounded-3xl p-6 md:p-10 shadow-[6px_6px_0px_0px_#5D4037]">
        <NewbieGuideContent />
      </div>
    </div>
  );
}

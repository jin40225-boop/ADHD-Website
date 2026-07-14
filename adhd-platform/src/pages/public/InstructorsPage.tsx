import { Award } from 'lucide-react';
import instructorsData from '../../data/instructors.json';

interface Instructor {
  id: string;
  name: string;
  title: string;
  bio: string;
}

export default function InstructorsPage() {
  const instructors = instructorsData as Instructor[];

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-[#5D4037] py-12 px-4 md:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-[#FFEC8B] border-2 border-[#5D4037] rounded-3xl p-8 shadow-[4px_4px_0px_0px_#5D4037]">
          <h1 className="text-3xl font-extrabold flex items-center gap-3">
            <Award className="w-8 h-8 text-[#D84315]" />
            倡議團隊與合作講師
          </h1>
          <p className="mt-2 text-sm md:text-base">
            由過來人大 A、專業心理師與身障中心社工共同建構的公益服務團隊。
          </p>
        </div>

        <div className="space-y-6">
          {instructors.map(inst => (
            <div
              key={inst.id}
              className="bg-white border-2 border-[#5D4037] rounded-3xl p-6 md:p-8 shadow-[6px_6px_0px_0px_#5D4037] space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[#80CBC4] border-2 border-[#5D4037] rounded-full flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_#5D4037]">
                  {inst.name[0]}
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold">{inst.name}</h2>
                  <p className="text-sm font-bold text-[#D84315]">{inst.title}</p>
                </div>
              </div>

              <div className="bg-[#FFFDF5] border border-[#5D4037]/20 rounded-2xl p-4 md:p-6 text-base leading-relaxed whitespace-pre-wrap font-medium">
                {inst.bio}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

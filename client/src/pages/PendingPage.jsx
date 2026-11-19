import { useEffect } from 'react';
import { Hourglass, MessageCircle, LogOut, Ban } from 'lucide-react';
import { useApp } from '../App.jsx';
import { Button, waLink } from '../ui/ui.jsx';
import { AuthLayout } from './AuthPage.jsx';

export default function PendingPage() {
  const { user, settings, logout, reload } = useApp();
  const blocked = user.status === 'blocked';

  // Poll so the student gets in the moment Adi approves.
  useEffect(() => {
    if (blocked) return undefined;
    const t = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, 15000);
    return () => clearInterval(t);
  }, [blocked, reload]);

  const msg = `היי עדי, כאן ${user.name} (${user.grade || ''}). נרשמתי ללומדה ואשמח לאישור גישה 🙏`;
  return (
    <AuthLayout>
      <div className="bg-white rounded-3xl border border-line shadow-[var(--shadow-pop)] p-8 text-center max-w-lg w-full mx-auto animate-pop">
        <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-5 ${blocked ? 'bg-rose-100 text-rose-600' : 'bg-gold-200 text-gold-600 animate-[float_3s_ease-in-out_infinite]'}`}>
          {blocked ? <Ban size={38} /> : <Hourglass size={38} />}
        </div>
        <h1 className="text-2xl font-black">{blocked ? 'הגישה הוקפאה' : `היי ${user.name.split(' ')[0]}, כמעט שם!`}</h1>
        <p className="text-slate-600 mt-2 leading-relaxed">
          {blocked
            ? 'הגישה לחשבון זה הוקפאה. לפרטים ניתן לפנות לעדי.'
            : 'ההרשמה התקבלה בהצלחה. עדי צריכה לאשר את החשבון ולפתוח לך את הנושאים – ברגע שזה יקרה, המסך הזה יתעדכן לבד.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
          <a href={waLink(settings.whatsappPhone, msg)} target="_blank" rel="noreferrer">
            <Button variant="green" icon={MessageCircle} className="w-full">שליחת הודעה לעדי</Button>
          </a>
          <Button variant="soft" icon={LogOut} onClick={logout}>יציאה</Button>
        </div>
      </div>
    </AuthLayout>
  );
}

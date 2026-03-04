import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import BottomNav from "@/components/BottomNav";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const sessionStr = cookieStore.get('session')?.value;
    
    if (!sessionStr) {
        redirect("/");
    }
    
    return (
        <div className="relative min-h-screen bg-background pb-20">
            {children}
            <BottomNav />
        </div>
    );
}

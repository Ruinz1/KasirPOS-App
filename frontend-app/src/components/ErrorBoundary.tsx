import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    message: string;
    isChunkError: boolean;
    reloading: boolean;
}

/**
 * Kegagalan memuat chunk (jaringan putus, atau file lama sudah diganti setelah
 * deploy baru) sebelumnya membuat layar jadi putih tanpa pesan. Di sini error
 * ditangkap: untuk kasus chunk, halaman dimuat ulang sekali secara otomatis
 * supaya user dapat versi terbaru tanpa perlu tahu apa-apa.
 */
const RELOAD_FLAG = "chunk-reload-attempt";

const isChunkLoadError = (error: Error): boolean => {
    const text = `${error?.name ?? ""} ${error?.message ?? ""}`;
    return (
        /ChunkLoadError/i.test(text) ||
        /Loading chunk .* failed/i.test(text) ||
        /Failed to fetch dynamically imported module/i.test(text) ||
        /Importing a module script failed/i.test(text) ||
        /error loading dynamically imported module/i.test(text)
    );
};

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, message: "", isChunkError: false, reloading: false };

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            message: error?.message ?? "Terjadi kesalahan",
            isChunkError: isChunkLoadError(error),
            reloading: false,
        };
    }

    componentDidCatch(error: Error) {
        console.error("Halaman gagal dimuat:", error);

        // Muat ulang otomatis sekali saja — kalau tetap gagal, tampilkan pesan
        // agar tidak terjebak dalam loop reload tanpa akhir.
        if (isChunkLoadError(error)) {
            let alreadyTried = "1";
            try {
                alreadyTried = sessionStorage.getItem(RELOAD_FLAG) ?? "";
            } catch {
                alreadyTried = "1"; // storage diblokir: jangan auto-reload
            }

            if (!alreadyTried) {
                try {
                    sessionStorage.setItem(RELOAD_FLAG, "1");
                } catch { /* diabaikan */ }
                this.setState({ reloading: true });
                window.location.reload();
            }
        }
    }

    componentDidMount() {
        // Halaman berhasil dimuat: bersihkan penanda supaya percobaan berikutnya
        // (di lain waktu) tetap mendapat satu kesempatan auto-reload.
        try {
            sessionStorage.removeItem(RELOAD_FLAG);
        } catch { /* diabaikan */ }
    }

    handleRetry = () => {
        try {
            sessionStorage.removeItem(RELOAD_FLAG);
        } catch { /* diabaikan */ }
        window.location.reload();
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        if (this.state.reloading) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Memuat ulang halaman...</p>
                </div>
            );
        }

        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="bg-destructive/10 rounded-full p-4">
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>
                <div>
                    <h1 className="text-lg font-bold mb-1">Halaman gagal dimuat</h1>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        {this.state.isChunkError
                            ? "Koneksi terputus saat memuat halaman, atau aplikasi baru saja diperbarui. Coba muat ulang."
                            : "Terjadi kesalahan saat menampilkan halaman ini."}
                    </p>
                </div>
                <Button onClick={this.handleRetry} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Muat Ulang
                </Button>
                {!this.state.isChunkError && this.state.message && (
                    <p className="text-[11px] text-muted-foreground/70 max-w-md break-words font-mono">
                        {this.state.message}
                    </p>
                )}
            </div>
        );
    }
}

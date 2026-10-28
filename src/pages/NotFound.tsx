import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#080b14]">
      <div className="vx-scene" aria-hidden />
      <div className="glass edge-glow relative mx-4 max-w-md rounded-2xl p-10 text-center">
        <div className="gradient-text font-display text-5xl font-bold">404</div>
        <p className="mt-3 text-lg text-slate-200">This vector does not exist</p>
        <p className="mt-1.5 text-sm text-slate-500">
          The page you are looking for is outside the embedding space of this lab.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-[#05070d] shadow-[0_0_20px_rgba(0,217,255,0.3)] transition-all hover:brightness-110"
        >
          Return to the Lab
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
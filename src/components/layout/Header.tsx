export default function Header() {
  return (
    <header className="header-bg text-white sticky top-0 z-30 shadow-md">
      <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="iocl-logo-container hidden md:flex" style={{ fontSize: '10px' }}>
            <div className="iocl-circle"><div className="iocl-band"><span className="iocl-hindi-text">इंडियनऑयल</span></div></div>
            <div className="iocl-english-text" style={{ color: 'white' }}>IndianOil</div>
            <div className="font-script text-orange-400 text-[10px] mt-1 whitespace-nowrap font-bold uppercase">The Energy of India</div>
          </div>
          <div className="flex flex-col items-center text-center font-bold"> 
            <h1 className="text-2xl md:text-3xl uppercase tracking-wider leading-none">Gujarat Refinery</h1>
            <p className="font-hindi text-blue-400 text-xs font-bold tracking-wide mt-1">जहाँ प्रगति ही जीवन सार है</p>
          </div>
        </div>
        <h2 className="text-xl text-orange-500 tracking-[0.1em] font-bold uppercase hidden md:block">SPARE SETU PORTAL</h2>
      </div>
    </header>
  );
}

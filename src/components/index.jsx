import React from 'react';
import marconi from '/marconi.jpg'

const Index = ({ children }) => {
    return (
    <section
        className="relative bg-cover bg-center bg-no-repeat min-h-screen w-full flex items-center justify-center"
        style={{ 
            backgroundImage: `url(${marconi})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
            '@media (max-width: 640px)': {
                backgroundAttachment: 'scroll'
            }
        }}
    >
    <div
        className="absolute inset-0 bg-gray-900/75 sm:bg-transparent sm:from-gray-900/95 sm:to-gray-900/25 ltr:sm:bg-gradient-to-r rtl:sm:bg-gradient-to-l"
    ></div>

    <div
        className="relative w-full max-w-screen-xl px-4 py-16 sm:py-24 lg:py-32 sm:px-6 flex justify-center items-center lg:items-left lg:justify-start"
    >
        <div className="w-full max-w-xl text-center lg:text-left">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#ff3e00] border-t-3 border-b-3 border-white uppercase drop-shadow-[0_1.6px_1.5px_rgba(0,0,0,0.8)] inline-block mt-0 mb-0 py-2 sm:py-3">
            Waveter
        </h1>
        <strong className="block font-extrabold text-white uppercase text-2xl sm:text-2xl md:text-3xl mt-3">
            Your Global Radio
        </strong>
        
        <p className="mt-4 max-w-lg text-white text-sm sm:text-base md:text-xl/relaxed">
            Tired of the same local channels? Let <b><i>Waveter</i></b> take you on an auditory journey around the globe.
        </p>

        {children}
        </div>
    </div>
    </section>
);
};

export default Index;
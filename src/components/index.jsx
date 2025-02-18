import React from 'react';
import marconi from '../../public/marconi.jpg'

const Index = ({ children }) => {
    return (
    <section
    className="relative bg-cover bg-center bg-no-repeat"
    style={{ backgroundImage: `url(${marconi})` }}
    >
    <div
        className="absolute inset-0 bg-gray-900/75 sm:bg-transparent sm:from-gray-900/95 sm:to-gray-900/25 ltr:sm:bg-gradient-to-r rtl:sm:bg-gradient-to-l"
    ></div>

    <div
        className="relative mx-auto max-w-screen-xl px-4 py-32 sm:px-6 lg:flex lg:h-screen lg:items-center lg:px-8"
    >
        <div className="max-w-xl text-center ltr:sm:text-left rtl:sm:text-right">
        <h1 className="text-3xl font-extrabold text-[#ff3e00] sm:text-7xl border-t-3 border-b-3 border-white uppercase drop-shadow-[0_1.6px_1.5px_rgba(0,0,0,0.8)] inline-block mt-0 mb-0 py-3">
        Waveter
        </h1>
        <strong className="block font-extrabold text-white uppercase text-3xl">Your Global Radio</strong>
        
        <p className="mt-4 max-w-lg text-white sm:text-xl/relaxed">
            Tired of the same local channels? Let <b><i>Waveter</i></b> take you on an auditory journey around the globe.
        </p>

        {children}
        </div>
    </div>
    </section>
);
};

export default Index;
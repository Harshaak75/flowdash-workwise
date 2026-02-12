
import React, { useState, useEffect } from 'react';
import { Loader2, Newspaper, Lightbulb, Info, BrainCircuit, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TIPS = [
    {
        icon: <Lightbulb className="w-6 h-6 text-yellow-500" />,
        title: "Productivity Tip",
        text: "Taking short breaks every hour can actually improve your focus and productivity."
    },
    {
        icon: <BrainCircuit className="w-6 h-6 text-indigo-500" />,
        title: "AI & The Future",
        text: "Generative AI is transforming industries. Did you know AI can now help draft reports, debug code, and even brainstorm creative ideas in seconds?"
    },
    {
        icon: <Cpu className="w-6 h-6 text-blue-500" />,
        title: "Tech Insight",
        text: "Quantum computing is on the horizon. It solves problems in minutes that would take traditional supercomputers thousands of years."
    },
    {
        icon: <Info className="w-6 h-6 text-teal-500" />,
        title: "Learning with AI",
        text: "Leverage AI to learn faster. Try asking an AI to explain complex topics 'like I'm 5' for a quick, intuitive understanding of new subjects."
    },
    {
        icon: <Lightbulb className="w-6 h-6 text-purple-500" />,
        title: "Wellness",
        text: "Stay hydrated! Drinking water throughout the day helps maintain energy levels and cognitive function."
    }
];

export const HRMLoader = () => {
    const [currentTip, setCurrentTip] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTip((prev) => (prev + 1) % TIPS.length);
        }, 4000); // Change tip every 4 seconds

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50/50 p-6">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">

                {/* Header Section */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
                    <div className="flex justify-center mb-4">
                        <div className="bg-white/20 p-3 rounded-full backdrop-blur-sm">
                            <Loader2 className="w-8 h-8 animate-spin text-white" />
                        </div>
                    </div>
                    <h2 className="text-xl font-bold mb-1">Connecting to HRM</h2>
                    <p className="text-blue-100 text-sm"> establishing secure connection...</p>
                </div>

                {/* Content Section (News/Tips) */}
                <div className="p-8 min-h-[200px] flex flex-col justify-center relative">
                    <AnimatePresence mode='wait'>
                        <motion.div
                            key={currentTip}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.5 }}
                            className="flex flex-col items-center text-center space-y-3"
                        >
                            <div className="p-2 bg-gray-50 rounded-full mb-2">
                                {TIPS[currentTip].icon}
                            </div>
                            <h3 className="font-semibold text-gray-800 text-lg">
                                {TIPS[currentTip].title}
                            </h3>
                            <p className="text-gray-600 leading-relaxed text-sm">
                                "{TIPS[currentTip].text}"
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer Progress Bar */}
                <div className="bg-gray-50 px-6 py-4">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <motion.div
                            className="h-full bg-blue-500 rounded-full"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{
                                duration: 2.5,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        />
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-2">
                        Please wait while we load your dashboard
                    </p>
                </div>

            </div>
        </div>
    );
};

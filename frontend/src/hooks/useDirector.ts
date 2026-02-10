import { useState, useEffect, useRef } from 'react';

export interface Alignment {
    word: string;
    start: number; // in seconds
    end: number;   // in seconds
}

export interface ScriptAction {
    trigger_word_index: number; // Index of the word in the alignment that triggers this action
    action_type: string;
    payload: any;
}

export interface DirectorState {
    currentWordIndex: number;
    activeActions: ScriptAction[];
    isPlaying: boolean;
    currentTime: number;
}

export function useDirector(audioUrl: string | null, alignment: Alignment[], scriptActions: ScriptAction[]) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [state, setState] = useState<DirectorState>({
        currentWordIndex: -1,
        activeActions: [],
        isPlaying: false,
        currentTime: 0,
    });

    useEffect(() => {
        if (!audioUrl) return;

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        const updateLoop = () => {
            if (!audio || audio.paused) return;
            
            const time = audio.currentTime;

            // Find current word
            const wordIndex = alignment.findIndex(
                (a) => time >= a.start && time <= a.end
            );

            // Find active actions (actions that have been triggered but maybe not "ended" - for now just trigger based on word index)
            // In a real scenario, we might want "accumulated" state, but here we just return the latest triggered actions.
            // Or better: return the *last* triggered action for each type?

            // Simple version: Find actions triggered at or before this word index
            const triggeredActions = scriptActions.filter(
                (action) => action.trigger_word_index <= wordIndex && action.trigger_word_index > -1
            );

            setState({
                currentWordIndex: wordIndex,
                activeActions: triggeredActions,
                isPlaying: !audio.paused,
                currentTime: time,
            });

            requestAnimationFrame(updateLoop);
        };

        audio.addEventListener('play', () => {
            requestAnimationFrame(updateLoop);
        });

        audio.addEventListener('ended', () => {
            setState(s => ({ ...s, isPlaying: false }));
        });

        return () => {
            audio.pause();
            audioRef.current = null;
        };
    }, [audioUrl, alignment, scriptActions]);

    const play = () => audioRef.current?.play();
    const pause = () => audioRef.current?.pause();

    return {
        play,
        pause,
        ...state,
    };
}

import React from 'react'
import TestimonialCard from '../testimonialcard/TestimonialCard'
import {
    IconButton,
    useMediaQuery
} from '@chakra-ui/react'
import {
    ArrowBackIcon,
    ArrowForwardIcon
} from '@chakra-ui/icons'

import {
    AnimatePresence,
    motion
} from 'framer-motion'
import { infoStructure } from "../../types/types"
type Props = {
    testimonials: infoStructure[];
}

export default function TestimonialDiv({ testimonials }: Props) {
    const [index, setTest] = React.useState<number>(0);
    const [isForward, setIsForward] = React.useState<boolean>(true);
    const [isAutoChange, setIsAutoChange] = React.useState<boolean>(true);
    const [smallScreen] = useMediaQuery('(max-width: 600px)');
    React.useEffect(() => {
        if (!isAutoChange) return;
        setTimeout(() => {
            setIsForward(true);
            index + 1 < testimonials.length ? setTest(index + 1) : setTest(0);
        }, 2500);
    }, [index])

    const back = () => {
        setIsForward(false);
        setIsAutoChange(false);
        index - 1 >= 0 ? setTest(index - 1) : setTest(testimonials.length - 1);
    }
    const forward = () => {
        setIsForward(true);
        setIsAutoChange(false);
        index + 1 < testimonials.length ? setTest(index + 1) : setTest(0);
    }
    return (
        <>
            <IconButton
                display={smallScreen ? "none" : "inline"}
                onClick={() => back()}
                aria-label='back'
                color="#C3B4B1"
                size="lg"
                _hover={{
                    color: "brown.700"
                }}
                variant="unstyled"
                icon={<ArrowBackIcon />}
            />
            <AnimatePresence exitBeforeEnter>
                <motion.div style={{ display: 'inline-block' }}
                    key={index}
                    initial={isForward ? { x: -35, opacity: 0 } : { x: 35, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={isForward ? { x: 35, opacity: 0 } : { x: -35, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <TestimonialCard toDisplay={testimonials[index]} />
                </motion.div>
            </AnimatePresence>
            <IconButton
                display={smallScreen ? "none" : "inline"}
                onClick={() => forward()}
                aria-label="forward"
                variant="unstyled"
                color="#C3B4B1"
                size="lg"
                _hover={{
                    color: "brown.700"
                }}
                icon={<ArrowForwardIcon />}
            />
        </>
    )
}
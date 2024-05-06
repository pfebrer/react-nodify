import { useState, useEffect } from 'react';

function getWindowDimensions() {
  const { innerWidth: width, innerHeight: height } = window;
  return {
    width,
    height
  };
}

function useWindowDimensions() {
  const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions());

  useEffect(() => {
    function handleResize() {
      setWindowDimensions(getWindowDimensions());
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowDimensions;
}

const Iframe = props => {
    const { height } = useWindowDimensions();

    return <iframe 
        src={props.src} title={props.title} aria-label={props.title}
        style={{height: height - 20, width: "99%"}}/>

}

export { Iframe }

export default Iframe;
/** B edition: lightweight site-wide blueprint, no particle/pointer engine. */
import LandingContent from '../components/LandingContent.jsx';
import IndustrialBackdrop from '../components/IndustrialBackdrop.jsx';
export default function EntryScene(props){
  return <div className="entry-page landing-page"><IndustrialBackdrop/><LandingContent {...props}/></div>;
}

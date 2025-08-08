import { BrowserRouter as Router, Routes, Route, Link} from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';

export default function App(){
    return (
        <Router>
            <nav style = {{ padding: '10px', background: "#f0f0f0"}}>
                <Link to="/" style={{ marginRight: "10px" }}>Home</Link>
                <Link to="/about">About</Link>
            </nav>

            <Routes>
                <Route path = "/" element={<Home />} />
                <Route path = "/about" element={<About />} />
            </Routes>
        </Router>
    );
}
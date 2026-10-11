import { Link } from 'react-router';
export function ProductLinks() {
  return (
    <nav className="product-links" aria-label="Help and policies">
      <Link to="/help">Help & contact</Link>
      <Link to="/privacy">Privacy</Link>
      <Link to="/terms">Terms</Link>
    </nav>
  );
}

import { Navigate, useParams } from 'react-router-dom';

/** Redirect legacy friend detail route to unified Friends page. */
export function FriendDetail() {
    const { friendshipId } = useParams();
    return <Navigate to={`/friends?friend=${friendshipId}`} replace />;
}

export default FriendDetail;

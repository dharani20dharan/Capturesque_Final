export function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (!token) {
    console.log("bad token");
    return {};
  }
  else{
      console.log("good token ",token);
      return {
      Authorization: `Bearer ${token}`,
    };
  }
}
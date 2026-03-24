import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('signup', 'routes/signup.tsx'),
  route('login', 'routes/login.tsx'),
  route('dashboard', 'routes/dashboard.tsx'),
  route('gatherings/new', 'routes/gatherings.new.tsx'),
  route('gatherings/:id', 'routes/gatherings.$id.tsx'),
  route('gatherings/:id/edit', 'routes/gatherings.$id.edit.tsx'),
  route('search', 'routes/search.tsx'),
  route('logout', 'routes/logout.tsx'),
] satisfies RouteConfig

import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { isAuthenticated } from '../api/auth';
import LoginPage from '../features/login/LoginPage';
import Dashboard from '../features/dashboard/Dashboard';
import OrgList from '../features/Inventory/OrganizationList/OrgList';
import OrgHierarchy from '../features/Inventory/OrganizationList/OrgHierarchy';
import OrgDetail from '../features/Inventory/OrganizationDetail/OrgDetail';
import BranchList from '../features/Inventory/BranchList/BranchList';
import BranchDetail from '../features/Inventory/BranchDetail/BranchDetail';
import ZoneList from '../features/Inventory/ZoneList/ZoneList';
import ZoneDetail from '../features/Inventory/ZoneDetail/ZoneDetail';
import RegionList from '../features/Inventory/RegionList/RegionList';
import RegionDetail from '../features/Inventory/RegionDetail/RegionDetail';
import ModelList from '../features/Inventory/ModelList/ModelList';
import ModelDetail from '../features/Inventory/ModelDetail/ModelDetail';
import LivePerformance from '../features/DevicePerformance/LivePerformance/LivePerformance';
import DevicePerformance from '../features/DevicePerformance/DevicePerformance/DevicePerformance';
import AlarmManagement from '../features/Alerts/AlarmManagement/AlarmManagement';
import AlarmConfiguration from '../features/Alerts/AlarmConfiguration/AlarmConfiguration';
import UserSpecificLogs from '../features/Logs/UserSpecificLogs/UserSpecificLogs';
import DeviceDeletionLogs from '../features/Logs/DeviceDeletionLogs/DeviceDeletionLogs';
import LoginLogs from '../features/Logs/LoginLogs/LoginLogs';
import OrgManagement from '../features/Management/OrgManagement/OrgManagement';
import BranchManagement from '../features/Management/BranchManagement/BranchManagement';
import AccountManagement from '../features/Management/AccountManagement/AccountManagement';
import OnBoard from '../features/Provisioning/OnBoard/OnBoard';
import TemplateManagement from '../features/Provisioning/TemplateCreation/TemplateManagement';
import TemplateEditor from '../features/Provisioning/TemplateCreation/TemplateEditor';
import GroupConfig from '../features/Provisioning/GroupConfig/GroupConfig';
import { canAccessConsole, getStoredSessionUser } from '../utils/roleManagement';

function Protected({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const user = getStoredSessionUser();
  if (!canAccessConsole(user)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RedirectDevicesToPerformance() {
  const [params] = useSearchParams();
  const qs = params.toString();
  return <Navigate to={`/live-performance${qs ? `?${qs}` : ''}`} replace />;
}

function RedirectDeviceToPerformance() {
  const { id } = useParams();
  const location = useLocation();
  return (
    <Navigate
      to={`/live-performance/${encodeURIComponent(id || '')}`}
      replace
      state={location.state}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />
        <Route
          path="/devices"
          element={
            <Protected>
              <RedirectDevicesToPerformance />
            </Protected>
          }
        />
        <Route
          path="/devices/:id"
          element={
            <Protected>
              <RedirectDeviceToPerformance />
            </Protected>
          }
        />
        <Route
          path="/inventory/region-list"
          element={
            <Protected>
              <RegionList />
            </Protected>
          }
        />
        <Route
          path="/inventory/region-list/:region"
          element={
            <Protected>
              <RegionDetail />
            </Protected>
          }
        />
        <Route
          path="/inventory/zone-list"
          element={
            <Protected>
              <ZoneList />
            </Protected>
          }
        />
        <Route
          path="/inventory/zone-list/:zone"
          element={
            <Protected>
              <ZoneDetail />
            </Protected>
          }
        />
        <Route
          path="/branches"
          element={
            <Protected>
              <BranchList />
            </Protected>
          }
        />
        <Route
          path="/branches/:id"
          element={
            <Protected>
              <BranchDetail />
            </Protected>
          }
        />
        <Route
          path="/inventory/models"
          element={
            <Protected>
              <ModelList />
            </Protected>
          }
        />
        <Route
          path="/inventory/models/:model"
          element={
            <Protected>
              <ModelDetail />
            </Protected>
          }
        />
        <Route
          path="/inventory/org-list"
          element={
            <Protected>
              <OrgList />
            </Protected>
          }
        />
        <Route
          path="/inventory/org-list/hierarchy"
          element={
            <Protected>
              <OrgHierarchy />
            </Protected>
          }
        />
        <Route
          path="/inventory/org-list/:orgId"
          element={
            <Protected>
              <OrgDetail />
            </Protected>
          }
        />
        <Route
          path="/inventory/org-crud"
          element={
            <Protected>
              <OrgManagement />
            </Protected>
          }
        />
        <Route
          path="/inventory/org-crud/:orgId/branches"
          element={
            <Protected>
              <BranchManagement />
            </Protected>
          }
        />
        <Route
          path="/account-management"
          element={
            <Protected>
              <AccountManagement />
            </Protected>
          }
        />
        <Route
          path="/log-management/login-logs"
          element={
            <Protected>
              <LoginLogs />
            </Protected>
          }
        />
        <Route
          path="/log-management/user-logs"
          element={
            <Protected>
              <UserSpecificLogs />
            </Protected>
          }
        />
        <Route
          path="/log-management/device-deletion-logs"
          element={
            <Protected>
              <DeviceDeletionLogs />
            </Protected>
          }
        />
        <Route
          path="/alarm-configuration"
          element={
            <Protected>
              <AlarmConfiguration />
            </Protected>
          }
        />
        <Route
          path="/alarm-management"
          element={
            <Protected>
              <AlarmManagement />
            </Protected>
          }
        />
        <Route
          path="/live-performance"
          element={
            <Protected>
              <LivePerformance />
            </Protected>
          }
        />
        <Route
          path="/live-performance/:id"
          element={
            <Protected>
              <DevicePerformance />
            </Protected>
          }
        />
        <Route
          path="/provisioning/onboard"
          element={
            <Protected>
              <OnBoard />
            </Protected>
          }
        />
        <Route
          path="/inventory/onboard"
          element={<Navigate to="/provisioning/onboard" replace />}
        />
        <Route
          path="/provisioning/template-creation"
          element={
            <Protected>
              <TemplateManagement />
            </Protected>
          }
        />
        <Route
          path="/provisioning/template-creation/new"
          element={
            <Protected>
              <TemplateEditor />
            </Protected>
          }
        />
        <Route
          path="/provisioning/template-creation/:id/edit"
          element={
            <Protected>
              <TemplateEditor />
            </Protected>
          }
        />
        <Route
          path="/provisioning/group-config"
          element={
            <Protected>
              <GroupConfig />
            </Protected>
          }
        />
        <Route
          path="/"
          element={<Navigate to={isAuthenticated() ? '/dashboard' : '/login'} replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

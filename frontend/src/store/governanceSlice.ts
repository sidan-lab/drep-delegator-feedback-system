import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type {
  GovernanceAction,
  GovernanceActionDetail,
  GovernanceActionType,
  VoteType,
  OverviewSummary,
  NCLDisplayData,
} from "@/types/governance";
import {
  fetchGovernanceActions,
  fetchGovernanceActionDetail,
  fetchOverviewSummary,
} from "@/services/api";

interface GovernanceState {
  // Data
  actions: GovernanceAction[];
  selectedAction: GovernanceActionDetail | null;
  overview: OverviewSummary | null;
  nclDataList: NCLDisplayData[]; // Multiple NCL years (2025, 2026)

  // Filters
  filters: {
    type: GovernanceActionType;
    searchQuery: string;
    voteFilter: VoteType;
  };

  // Loading states
  isLoadingActions: boolean;
  isLoadingDetail: boolean;
  isLoadingOverview: boolean;

  // Error states
  actionsError: string | null;
  detailError: string | null;
  overviewError: string | null;
}

const initialState: GovernanceState = {
  actions: [],
  selectedAction: null,
  overview: null,
  nclDataList: [],
  filters: {
    type: "All",
    searchQuery: "",
    voteFilter: "All",
  },
  isLoadingActions: false,
  isLoadingDetail: false,
  isLoadingOverview: false,
  actionsError: null,
  detailError: null,
  overviewError: null,
};

// Async thunks for API calls
export const loadGovernanceActions = createAsyncThunk(
  "governance/loadActions",
  async (_, { rejectWithValue }) => {
    try {
      return await fetchGovernanceActions();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to load governance actions"
      );
    }
  }
);

export const loadGovernanceActionDetail = createAsyncThunk(
  "governance/loadDetail",
  async (proposalId: string, { rejectWithValue }) => {
    try {
      const detail = await fetchGovernanceActionDetail(proposalId);
      if (!detail) {
        return rejectWithValue("Governance action not found");
      }
      return detail;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to load governance action detail"
      );
    }
  }
);

export const loadOverviewSummary = createAsyncThunk(
  "governance/loadOverview",
  async (_, { rejectWithValue }) => {
    try {
      return await fetchOverviewSummary();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to load overview summary"
      );
    }
  }
);

const governanceSlice = createSlice({
  name: "governance",
  initialState,
  reducers: {
    setActions: (state, action: PayloadAction<GovernanceAction[]>) => {
      state.actions = action.payload;
      state.actionsError = null;
    },
    setSelectedAction: (
      state,
      action: PayloadAction<GovernanceActionDetail | null>
    ) => {
      state.selectedAction = action.payload;
      state.detailError = null;
    },
    setOverview: (state, action: PayloadAction<OverviewSummary | null>) => {
      state.overview = action.payload;
      state.overviewError = null;
    },
    setNCLDataList: (state, action: PayloadAction<NCLDisplayData[]>) => {
      state.nclDataList = action.payload;
    },
    setTypeFilter: (state, action: PayloadAction<GovernanceActionType>) => {
      state.filters.type = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.filters.searchQuery = action.payload;
    },
    setVoteFilter: (state, action: PayloadAction<VoteType>) => {
      state.filters.voteFilter = action.payload;
    },
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearErrors: (state) => {
      state.actionsError = null;
      state.detailError = null;
      state.overviewError = null;
    },
  },
  extraReducers: (builder) => {
    // Load governance actions
    builder
      .addCase(loadGovernanceActions.pending, (state) => {
        state.isLoadingActions = true;
        state.actionsError = null;
      })
      .addCase(loadGovernanceActions.fulfilled, (state, action) => {
        state.isLoadingActions = false;
        state.actions = action.payload;
      })
      .addCase(loadGovernanceActions.rejected, (state, action) => {
        state.isLoadingActions = false;
        state.actionsError = action.payload as string;
      });

    // Load governance action detail
    builder
      .addCase(loadGovernanceActionDetail.pending, (state) => {
        state.isLoadingDetail = true;
        state.detailError = null;
        // NOTE: Do NOT clear selectedAction here - this causes VoteOnProposal to unmount
        // during polling, which closes the voting modal prematurely.
        // Keep existing data visible while refreshing (stale-while-revalidate pattern).
      })
      .addCase(loadGovernanceActionDetail.fulfilled, (state, action) => {
        state.isLoadingDetail = false;
        state.selectedAction = action.payload;
      })
      .addCase(loadGovernanceActionDetail.rejected, (state, action) => {
        state.isLoadingDetail = false;
        state.detailError = action.payload as string;
      });

    // Load overview summary (includes NCL data)
    builder
      .addCase(loadOverviewSummary.pending, (state) => {
        state.isLoadingOverview = true;
        state.overviewError = null;
      })
      .addCase(loadOverviewSummary.fulfilled, (state, action) => {
        state.isLoadingOverview = false;
        state.overview = action.payload;
        // Extract and transform NCL data from overview response
        if (action.payload.nclData) {
          state.nclDataList = action.payload.nclData.map((ncl) => {
            const currentAda = Number(ncl.currentValue) / 1_000_000;
            const targetAda = Number(ncl.targetValue) / 1_000_000;
            const percentUsed = targetAda > 0 ? (currentAda / targetAda) * 100 : 0;
            return {
              year: ncl.year,
              currentValueAda: currentAda,
              targetValueAda: targetAda,
              percentUsed,
              isExtended: ncl.year === 2025, // 2025 NCL is extended
            };
          });
        }
      })
      .addCase(loadOverviewSummary.rejected, (state, action) => {
        state.isLoadingOverview = false;
        state.overviewError = action.payload as string;
      });
  },
});

export const {
  setActions,
  setSelectedAction,
  setOverview,
  setNCLDataList,
  setTypeFilter,
  setSearchQuery,
  setVoteFilter,
  resetFilters,
  clearErrors,
} = governanceSlice.actions;

export default governanceSlice.reducer;
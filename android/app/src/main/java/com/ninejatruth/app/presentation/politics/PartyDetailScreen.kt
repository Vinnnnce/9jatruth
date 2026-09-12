package com.ninejatruth.app.presentation.politics

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import com.ninejatruth.app.domain.model.Party
import com.ninejatruth.app.domain.repository.PoliticsRepository
import com.ninejatruth.app.domain.util.Result
import com.ninejatruth.app.presentation.components.ErrorView
import com.ninejatruth.app.presentation.components.LoadingIndicator
import com.ninejatruth.app.presentation.components.TruthScoreBadge
import com.ninejatruth.app.presentation.theme.NigeriaGreen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PartyDetailUiState(
    val isLoading: Boolean = false,
    val party: Party? = null,
    val error: String? = null
)

@HiltViewModel
class PartyDetailViewModel @Inject constructor(
    private val politicsRepository: PoliticsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(PartyDetailUiState())
    val uiState: StateFlow<PartyDetailUiState> = _uiState.asStateFlow()

    fun loadParty(partyId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            politicsRepository.getParty(partyId).collect { result ->
                when (result) {
                    is Result.Loading -> _uiState.value = _uiState.value.copy(isLoading = true)
                    is Result.Success -> _uiState.value = PartyDetailUiState(party = result.data)
                    is Result.Error -> _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                }
            }
        }
    }
}

@Composable
fun PartyDetailScreen(
    partyId: String,
    onBack: () -> Unit,
    viewModel: PartyDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(partyId) {
        viewModel.loadParty(partyId)
    }

    Scaffold(
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onBack) {
                    Text("Back", color = NigeriaGreen)
                }
            }
        }
    ) { padding ->
        if (uiState.isLoading) {
            LoadingIndicator(modifier = Modifier.padding(padding))
            return@Scaffold
        }

        if (uiState.error != null) {
            ErrorView(
                message = uiState.error!!,
                onRetry = { viewModel.loadParty(partyId) },
                modifier = Modifier.padding(padding)
            )
            return@Scaffold
        }

        val party = uiState.party ?: return@Scaffold

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(containerColor = NigeriaGreen)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = party.acronym,
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = party.name,
                        style = MaterialTheme.typography.titleMedium,
                        color = Color.White
                    )
                    if (party.foundedYear != null) {
                        Text(
                            text = "Founded ${party.foundedYear}",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                    TruthScoreBadge(score = party.truthScore)
                }
            }

            // Details
            DetailRow("Ideology", party.ideology)
            DetailRow("Chairman", party.chairman)
            DetailRow("Headquarters", party.headquarters)
            if (party.memberCount != null) {
                DetailRow("Members", "${party.memberCount}")
            }
            if (party.website != null) {
                DetailRow("Website", party.website)
            }
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String?) {
    if (value == null) return
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold
        )
    }
}

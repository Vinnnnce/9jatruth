package com.ninejatruth.app.presentation.politics

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
import com.ninejatruth.app.domain.model.Election
import com.ninejatruth.app.domain.repository.PoliticsRepository
import com.ninejatruth.app.domain.util.Result
import com.ninejatruth.app.presentation.components.ErrorView
import com.ninejatruth.app.presentation.components.LoadingIndicator
import com.ninejatruth.app.presentation.theme.NigeriaGreen
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ElectionDetailUiState(
    val isLoading: Boolean = false,
    val election: Election? = null,
    val error: String? = null
)

@HiltViewModel
class ElectionDetailViewModel @Inject constructor(
    private val politicsRepository: PoliticsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ElectionDetailUiState())
    val uiState: StateFlow<ElectionDetailUiState> = _uiState.asStateFlow()

    fun loadElection(electionId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            politicsRepository.getElection(electionId).collect { result ->
                when (result) {
                    is Result.Loading -> _uiState.value = _uiState.value.copy(isLoading = true)
                    is Result.Success -> _uiState.value = ElectionDetailUiState(election = result.data)
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
fun ElectionDetailScreen(
    electionId: String,
    onBack: () -> Unit,
    viewModel: ElectionDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(electionId) {
        viewModel.loadElection(electionId)
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
                onRetry = { viewModel.loadElection(electionId) },
                modifier = Modifier.padding(padding)
            )
            return@Scaffold
        }

        val election = uiState.election ?: return@Scaffold

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header card
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(containerColor = NigeriaGreen)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Surface(
                        shape = MaterialTheme.shapes.small,
                        color = Color.White.copy(alpha = 0.2f)
                    ) {
                        Text(
                            text = election.status.replaceFirstChar { it.uppercase() },
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                    Text(
                        text = election.title,
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    if (election.officeName != null) {
                        Text(
                            text = election.officeName,
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color.White.copy(alpha = 0.85f)
                        )
                    }
                }
            }

            // Details
            DetailRow("Date", election.date)
            DetailRow("Type", election.type)
            if (election.stateName != null) {
                DetailRow("State", election.stateName)
            }
            if (election.registrationDeadline != null) {
                DetailRow("Registration Deadline", election.registrationDeadline)
            }
            if (election.totalVotes != null) {
                DetailRow("Total Votes", "${election.totalVotes}")
            }
            if (election.turnout != null) {
                DetailRow("Turnout", "${election.turnout}%")
            }

            // Description
            if (election.description != null) {
                Text(
                    text = "About",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = election.description,
                    style = MaterialTheme.typography.bodyMedium
                )
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
